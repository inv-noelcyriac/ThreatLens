from django.db.models import Count, Q, F, IntegerField, ExpressionWrapper
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from .models import MasterVulnerability, ManualRemediation, RemediationVote
from .serializers import ManualRemediationSerializer


class RemediationPagination(PageNumberPagination):
    """
    Standard page-number pagination for remediations/comments.
    Default page size = 10 (as requested by Frontend).
    """
    page_size = 10
    page_size_query_param = 'page_size'  # Allows frontend to override: ?page_size=20
    max_page_size = 50


class RemediationListCreateView(APIView):
    """
    GET: Retrieve notes for a specific vulnerability display_id with vote counts and net score.
         Supports query parameters: 
           - ?sort=top or ?sort=newest (default)
           - ?page=1 (default: 1, 10 items per page)
           - ?page_size=10 (optional)
    POST: Create a new note under a vulnerability display_id attached to logged-in user.
    """
    permission_classes = [IsAuthenticatedOrReadOnly]
    pagination_class = RemediationPagination

    def get(self, request, display_id):
        vuln = get_object_or_404(MasterVulnerability, display_id=display_id)
        
        sort_by = request.GET.get('sort', 'newest').lower().strip()

        # Annotate vote counts and calculate net score at the database level
        remediations = vuln.remediations.annotate(
            upvotes=Count('votes', filter=Q(votes__vote_type=RemediationVote.VoteChoices.UPVOTE)),
            downvotes=Count('votes', filter=Q(votes__vote_type=RemediationVote.VoteChoices.DOWNVOTE)),
            score=ExpressionWrapper(
                F('upvotes') - F('downvotes'),
                output_field=IntegerField()
            )
        )

        # Apply requested sort order using updated_at timestamp
        if sort_by == 'top':
            # Highest net score first; tie-breaker: newest updated date
            remediations = remediations.order_by('-score', '-updated_at')
        else:
            # Default: Reverse chronological order by updated timestamp
            remediations = remediations.order_by('-updated_at')

        # --- PAGINATION LOGIC ---
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(remediations, request, view=self)

        if page is not None:
            serializer = ManualRemediationSerializer(
                page, 
                many=True, 
                context={'request': request}
            )
            return paginator.get_paginated_response(serializer.data)

        # Fallback if pagination is disabled or returns None
        serializer = ManualRemediationSerializer(
            remediations, 
            many=True, 
            context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, display_id):
        vuln = get_object_or_404(MasterVulnerability, display_id=display_id)
        serializer = ManualRemediationSerializer(
            data=request.data, 
            context={'request': request}
        )

        if serializer.is_valid():
            # Automatically assign authenticated user as author
            serializer.save(master_vuln=vuln, user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RemediationDetailView(APIView):
    """
    PATCH: Edit an existing note (Author or Admin only).
    DELETE: Delete an existing note (Author or Admin only).
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        remediation = get_object_or_404(ManualRemediation, pk=pk)

        # Ownership Check
        if remediation.user != request.user and not request.user.is_staff:
            return Response(
                {"error": "You can only edit your own guidance notes."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ManualRemediationSerializer(
            remediation, 
            data=request.data, 
            partial=True, 
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()  # Triggers auto_now update on updated_at
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        remediation = get_object_or_404(ManualRemediation, pk=pk)

        # Ownership Check
        if remediation.user != request.user and not request.user.is_staff:
            return Response(
                {"error": "You can only delete your own guidance notes."},
                status=status.HTTP_403_FORBIDDEN
            )

        remediation.delete()
        return Response(
            {"message": "Comment got deleted", "id": pk},
            status=status.HTTP_200_OK
        )


class RemediationVoteView(APIView):
    """
    POST: Upvote (+1) or Downvote (-1) a remediation guidance note.
    Payload: { "vote_type": 1 } or { "vote_type": -1 }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        remediation = get_object_or_404(ManualRemediation, pk=pk)
        vote_value = request.data.get('vote_type')

        if vote_value not in [RemediationVote.VoteChoices.UPVOTE, RemediationVote.VoteChoices.DOWNVOTE]:
            return Response(
                {"error": "Invalid vote_type. Allowed values are 1 (Upvote) or -1 (Downvote)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        vote, created = RemediationVote.objects.get_or_create(
            remediation=remediation,
            user=request.user,
            defaults={'vote_type': vote_value}
        )

        if not created:
            if vote.vote_type == vote_value:
                # User clicked the same button again -> Toggle/Remove vote
                vote.delete()
                user_vote = 0
                action = "removed"
            else:
                # User switched vote (e.g. from Upvote to Downvote)
                vote.vote_type = vote_value
                vote.save()
                user_vote = vote_value
                action = "switched"
        else:
            user_vote = vote_value
            action = "created"

        # Return updated counts and net score
        upvotes = remediation.votes.filter(vote_type=RemediationVote.VoteChoices.UPVOTE).count()
        downvotes = remediation.votes.filter(vote_type=RemediationVote.VoteChoices.DOWNVOTE).count()
        score = upvotes - downvotes

        return Response({
            "action": action,
            "remediation_id": remediation.id,
            "score": score,
            "upvotes": upvotes,
            "downvotes": downvotes,
            "user_vote": user_vote
        }, status=status.HTTP_200_OK)