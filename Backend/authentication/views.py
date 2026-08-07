from django.conf import settings
from django.contrib.auth.models import User
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


class GoogleAuthView(APIView):
    """
    POST /api/v1/auth/google/
    Payload: { "credential": "<google_id_token>" } or { "token": "<google_id_token>" }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token") or request.data.get("credential") or request.data.get("id_token")

        if not token:
            return Response(
                {"error": "Google ID token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # 1. Cryptographically verify the Google ID token
            id_info = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )

            # 2. Extract identity info
            email = id_info.get("email", "").strip().lower()
            email_verified = id_info.get("email_verified", False)
            first_name = id_info.get("given_name", "")
            last_name = id_info.get("family_name", "")
            
            # Google Workspace hosted domain claim (optional secondary check)
            hd = id_info.get("hd", "").lower()

            # ------------------------------------------------------------------
            # DOMAIN CHECK GUARDRAIL
            # ------------------------------------------------------------------
            allowed_domain = os.environ.get('ALLOWED_ORGANIZATION_DOMAIN')

            if not email_verified:
                return Response(
                    {"error": "Google account email is not verified."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Enforce strict domain ending (@innovaturelabs.com)
            if not email.endswith(f"@{allowed_domain}"):
                return Response(
                    {
                        "error": f"Access denied. Only @{allowed_domain} accounts are authorized."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # 3. Get or create Django user using email as username
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "is_active": True,
                },
            )

            if not user.is_active:
                return Response(
                    {"error": "User account is disabled by an administrator."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if not created:
                user.first_name = first_name or user.first_name
                user.last_name = last_name or user.last_name
                user.save()

            # 4. Mint JWT access & refresh tokens
            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "is_staff": user.is_staff,
                        "is_superuser": user.is_superuser,
                    },
                },
                status=status.HTTP_200_OK,
            )

        except ValueError as e:
            return Response(
                {"error": f"Invalid or expired Google token: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response(
                {"error": "An error occurred during authentication."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UserProfileView(APIView):
    """
    GET /api/v1/auth/me/
    Header: Authorization: Bearer <access_token>
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            }
        )