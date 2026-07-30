from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import MasterVulnerability, ManualRemediation
from .serializers import ManualRemediationSerializer


class RemediationListCreateView(APIView):
    """
    GET: Retrieve all notes for a specific vulnerability display_id.
    POST: Create a new note under a vulnerability display_id.
    """
    def get(self, request, display_id):
        vuln = get_object_or_404(MasterVulnerability, display_id=display_id)
        remediations = vuln.remediations.all()
        serializer = ManualRemediationSerializer(remediations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, display_id):
        vuln = get_object_or_404(MasterVulnerability, display_id=display_id)
        serializer = ManualRemediationSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(master_vuln=vuln)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RemediationDetailView(APIView):
    """
    PATCH: Edit an existing note.
    DELETE: Delete an existing note.
    """
    def patch(self, request, pk):
        remediation = get_object_or_404(ManualRemediation, pk=pk)
        serializer = ManualRemediationSerializer(remediation, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        remediation = get_object_or_404(ManualRemediation, pk=pk)
        remediation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)