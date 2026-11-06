from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path


def spa_index_view(request):
    """
    Serve the production React application index.html for root and client routes.
    WhiteNoise serves compiled static assets directly at /assets/ and /static/.
    """
    index_file = settings.BASE_DIR.parent / "frontend" / "dist" / "index.html"
    if index_file.exists():
        return HttpResponse(index_file.read_text(encoding="utf-8"), content_type="text/html")
    return HttpResponse(
        "<!doctype html>"
        "<html><head><title>Weather-Aware Truck Routing</title></head>"
        "<body style='font-family:sans-serif;padding:2rem;text-align:center;'>"
        "<h2>Weather-Aware Truck Routing API</h2>"
        "<p>Backend service is operational. Frontend bundle is building or running via Vite dev server.</p>"
        "<p><a href='/api/health/'>Check /api/health/</a></p>"
        "</body></html>",
        content_type="text/html",
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("routing.urls")),
    re_path(r"^(?!api/|admin/|static/|assets/).*$", spa_index_view, name="spa-index"),
]
