export interface CircuitPose { x: number; z: number; yaw: number }

/** Constant-distance oval with straight sides and smooth semicircular turns. Front is -Z. */
export function circuitPose(distance: number, radius: number, halfStraight: number,
  out: CircuitPose = { x: 0, z: 0, yaw: 0 }): CircuitPose {
  const straight = halfStraight * 2;
  const turn = Math.PI * radius;
  const length = straight * 2 + turn * 2;
  let d = ((distance % length) + length) % length;
  if (d < straight) {
    out.x = radius; out.z = halfStraight - d; out.yaw = 0;
  } else if ((d -= straight) < turn) {
    const angle = d / radius;
    out.x = radius * Math.cos(angle); out.z = -halfStraight - radius * Math.sin(angle); out.yaw = angle;
  } else if ((d -= turn) < straight) {
    out.x = -radius; out.z = -halfStraight + d; out.yaw = Math.PI;
  } else {
    const angle = (d - straight) / radius;
    out.x = -radius * Math.cos(angle); out.z = halfStraight + radius * Math.sin(angle); out.yaw = Math.PI + angle;
  }
  return out;
}
