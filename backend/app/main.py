from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .models import ShapePayload

app = FastAPI(title="Prism API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/shape")
def receive_shape(payload: ShapePayload):
    """
    Phase 1 stub: log the received polygon + shape params and echo them back.
    Later this can compute geometry server-side, validate, or persist shapes.
    """
    print(
        f"[shape] model={payload.model_name!r}  "
        f"mode={payload.shape_mode}  "
        f"verts={len(payload.vertices)}  "
        f"closed={payload.is_closed}  "
        f"depth={payload.depth:.2f}  height={payload.height:.2f}"
    )
    return {"received": True, "model_id": payload.model_id, "vertex_count": len(payload.vertices)}
