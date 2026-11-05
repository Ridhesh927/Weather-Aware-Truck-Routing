from django.urls import path

from routing.views import health_check, plan_trip

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("trips/plan/", plan_trip, name="plan_trip"),
]
