#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "=== 1. Building React Frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== 2. Installing Backend Dependencies ==="
cd backend
python -m pip install --upgrade pip
pip install -r requirements.txt

echo "=== 3. Collecting Static Files & Applying Migrations ==="
python manage.py collectstatic --noinput
python manage.py migrate --noinput
cd ..

echo "=== Build Complete! Ready for Deployment ==="

