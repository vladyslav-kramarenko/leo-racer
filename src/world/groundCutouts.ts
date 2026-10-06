import type * as THREE from 'three';

/** Remove only the excavation footprints from the otherwise continuous ground plane. */
export function applyGroundCutouts(material: THREE.MeshLambertMaterial, holes: THREE.Vector4[], rotations: THREE.Vector2[]): void {
  if (!holes.length) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.groundHoles = { value: holes };
    shader.uniforms.groundHoleRotations = { value: rotations };
    shader.vertexShader = `varying vec2 groundWorldXZ;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ngroundWorldXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = `varying vec2 groundWorldXZ;\nuniform vec4 groundHoles[${holes.length}];\nuniform vec2 groundHoleRotations[${holes.length}];\n${shader.fragmentShader}`
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < ${holes.length}; i++) {
          vec4 hole = groundHoles[i];
          vec2 delta = groundWorldXZ - hole.xy;
          vec2 rotation = groundHoleRotations[i];
          vec2 local = vec2(dot(delta, vec2(rotation.x, -rotation.y)), dot(delta, rotation.yx));
          if (hole.z > 0.0 && abs(local.x) < hole.z && abs(local.y) < hole.w) discard;
        }`);
  };
  material.customProgramCacheKey = () => `ground-cutouts-${holes.length}`;
}
