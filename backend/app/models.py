from pydantic import BaseModel
from typing import Literal, Union


class Vertex2D(BaseModel):
    x: float
    y: float


class ApexAnchorCentroid(BaseModel):
    type: Literal['centroid'] = 'centroid'


class ApexAnchorVertex(BaseModel):
    vertexIndex: int


ApexAnchor = Union[Literal['centroid'], ApexAnchorVertex]


class ShapePayload(BaseModel):
    vertices:     list[Vertex2D]
    is_closed:    bool
    shape_mode:   Literal['extrude', 'apex']
    depth:        float
    height:       float
    apex_anchor:  ApexAnchor
    active_plane: Literal['XY', 'XZ', 'YZ']
    model_id:     str
    model_name:   str
