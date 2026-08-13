from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from authentication.views import GoogleAuthView, UserProfileView

urlpatterns = [
    # POST /api/v1/auth/google/ -> Accepts Google token & returns JWT tokens
    path("google/", GoogleAuthView.as_view(), name="google_auth"),
    
    # GET /api/v1/auth/me/ -> Accepts JWT Bearer token & returns user details
    path("me/", UserProfileView.as_view(), name="user_profile"),
    
    # POST /api/v1/auth/token/refresh/ -> Accepts refresh token & returns a fresh access token
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]