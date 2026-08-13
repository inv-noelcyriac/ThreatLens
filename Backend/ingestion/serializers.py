from rest_framework import serializers
from .models import ManualRemediation, RemediationVote


class RemediationVoteSerializer(serializers.ModelSerializer):
    vote_type = serializers.ChoiceField(choices=RemediationVote.VoteChoices.choices)

    class Meta:
        model = RemediationVote
        fields = ['id', 'remediation', 'user', 'vote_type', 'created_at']
        read_only_fields = ['id', 'remediation', 'user', 'created_at']


class ManualRemediationSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author_full_name', read_only=True)
    author_email = serializers.EmailField(source='user.email', read_only=True)
    upvotes = serializers.IntegerField(read_only=True, default=0)
    downvotes = serializers.IntegerField(read_only=True, default=0)
    score = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    is_edited = serializers.SerializerMethodField()

    class Meta:
        model = ManualRemediation
        fields = [
            'id',
            'master_vuln',
            'author_name',
            'author_email',
            'guidance_text',
            'score',
            'upvotes',
            'downvotes',
            'user_vote',
            'is_edited',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'master_vuln', 'created_at', 'updated_at']

    def get_score(self, obj) -> int:
        """
        Calculates net score = upvotes - downvotes.
        Uses annotated fields if present from queryset, otherwise performs a fallback DB query.
        """
        score = getattr(obj, 'score', None)
        if score is not None:
            return score

        upvotes = getattr(obj, 'upvotes', None)
        downvotes = getattr(obj, 'downvotes', None)

        if upvotes is None or downvotes is None:
            upvotes = obj.votes.filter(vote_type=RemediationVote.VoteChoices.UPVOTE).count()
            downvotes = obj.votes.filter(vote_type=RemediationVote.VoteChoices.DOWNVOTE).count()

        return upvotes - downvotes

    def get_user_vote(self, obj) -> int:
        """
        Returns:
          1  -> Requesting user upvoted this comment
         -1  -> Requesting user downvoted this comment
          0  -> Requesting user has not voted or is not logged in
        """
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return 0

        vote = obj.votes.filter(user=request.user).first()
        return vote.vote_type if vote else 0

    def get_is_edited(self, obj) -> bool:
        """
        Returns True if the comment was edited after creation.
        """
        if not obj.created_at or not obj.updated_at:
            return False
        # Ignores minor millisecond differences during initial save
        return (obj.updated_at - obj.created_at).total_seconds() > 1

    def validate_guidance_text(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Guidance text is required.")
        return value.strip()