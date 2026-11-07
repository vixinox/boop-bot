export type OrbitPose = {
  radius: number
  theta: number
  phi: number
}

export function interpolateOrbitPose(from: OrbitPose, to: OrbitPose, progress: number) {
  const thetaDelta =
    ((((to.theta - from.theta + Math.PI) % (Math.PI * 2)) + Math.PI * 2) %
      (Math.PI * 2)) -
    Math.PI

  return {
    radius: from.radius + (to.radius - from.radius) * progress,
    theta: from.theta + thetaDelta * progress,
    phi: from.phi + (to.phi - from.phi) * progress,
  }
}
