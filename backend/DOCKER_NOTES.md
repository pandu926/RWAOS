# docker-compose Fragment Notes (Do Not Auto-Apply)

Use this as a reference fragment if you need to wire backend + postgres in `/root/RWAOS/docker-compose.yml`.

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/rwaos_backend
      BACKEND_PORT: 8080
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: rwaos_backend
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```
