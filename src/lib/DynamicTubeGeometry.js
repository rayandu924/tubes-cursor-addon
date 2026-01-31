/**
 * DynamicTubeGeometry
 * A tube geometry that can be updated in real-time
 */

import {
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
} from 'three';

export class DynamicTubeGeometry extends TubeGeometry {
  constructor(tubularSegments = 64, radius = 1, radialSegments = 8) {
    // Create initial points along Z axis
    const points = new Array(tubularSegments + 1).fill(0).map(() => new Vector3());

    // Initialize points positions
    points.forEach((point, index) => {
      point.z = (-index / tubularSegments) * 2;
    });

    // Create curve from points
    const curve = new CatmullRomCurve3(points);

    // Call parent constructor
    super(curve, tubularSegments, radius, radialSegments, false);

    // Store reference to curve
    this.curve = curve;
  }

  /**
   * Update geometry based on current curve points
   */
  update() {
    updateTubeGeometry(this);
  }
}

// Reusable vectors to avoid allocations per frame
const _normal = new Vector3();
const _vertex = new Vector3();

/**
 * Update tube geometry vertices based on curve
 * @param {DynamicTubeGeometry} geometry
 */
function updateTubeGeometry(geometry) {
  const { curve } = geometry;
  const { tubularSegments, radius, radialSegments } = geometry.parameters;

  // Compute Frenet frames for the curve
  const frames = curve.computeFrenetFrames(curve.points.length, false);

  // Get attribute arrays
  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');

  // Use module-level reusable vectors
  const normal = _normal;
  const vertex = _vertex;

  // Update each segment
  for (let i = 0; i <= tubularSegments; i++) {
    generateSegment(i);
  }

  function generateSegment(segmentIndex) {
    // Progress along tube (0 to 1)
    const t = segmentIndex / tubularSegments;

    // Tapered radius - thicker in middle, thinner at ends
    const currentRadius = Math.sin(t * Math.PI) * radius;

    // Get point on curve
    vertex.copy(curve.points[segmentIndex]);

    // Starting index in attribute array
    let index = segmentIndex * (radialSegments + 1);

    // Get frame vectors
    const N = frames.normals[segmentIndex];
    const B = frames.binormals[segmentIndex];

    // Generate vertices around the circumference
    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const sinAngle = Math.sin(angle);
      const cosAngle = -Math.cos(angle);

      // Calculate normal
      normal.x = cosAngle * N.x + sinAngle * B.x;
      normal.y = cosAngle * N.y + sinAngle * B.y;
      normal.z = cosAngle * N.z + sinAngle * B.z;
      normal.normalize();

      // Set position
      positionAttr.setXYZ(
        index,
        vertex.x + currentRadius * normal.x,
        vertex.y + currentRadius * normal.y,
        vertex.z + currentRadius * normal.z
      );

      // Set normal
      normalAttr.setXYZ(index, normal.x, normal.y, normal.z);

      index++;
    }
  }

  // Flag for update
  positionAttr.needsUpdate = true;
  normalAttr.needsUpdate = true;
}

export default DynamicTubeGeometry;
