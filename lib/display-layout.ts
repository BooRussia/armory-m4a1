import * as THREE from 'three';

// Arbitrary art presentation offsets, never mechanical travel or assembly paths.
const OFFSETS: Record<string, [number, number, number]> = {
  Base: [0, 0, 0], Barrel: [-.55, 0, 0], Handguard: [-.35, 1, 0],
  Pistol_Grip: [.3, -1.2, 0], Stock: [1.5, .25, 0], Magazine: [-.2, -1.4, 0],
  Front_Sight: [-.65, 1.8, 0], Muzzle_Exterior: [-1.4, 0, 0],
  Sight: [.2, 1.1, 0], Sight_2: [.65, 1.8, 0],
  Optic: [.45, 1.65, 0], Foregrip: [-1, -1.2, 0], Light: [-.45, .4, 1.2],
};

export function isDisplayVisible(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) { if (!current.visible) return false; current = current.parent; }
  return true;
}

export function visibleDisplayBounds(root: THREE.Object3D, part?: string) {
  const bounds = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (part && object.userData.assetPart !== part) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

export function createDisplayLayout(root: THREE.Group) {
  let detail = 0;
  const pieces: { mesh: THREE.Object3D; rest: THREE.Vector3; offset: THREE.Vector3 }[] = [];
  root.children.forEach(object => {
    if (!(object instanceof THREE.Mesh) && !object.userData.displayPiece) return;
    const offset = OFFSETS[String(object.userData.assetPart ?? object.name)] ?? [1.5 + (detail % 4) * .52, 1.1 + Math.floor(detail++ / 4) * .5, .15];
    pieces.push({mesh:object,rest:object.position.clone(),offset:new THREE.Vector3(...offset).divideScalar(root.scale.x)});
  });
  return {
    set(amount: number) {
      const value = THREE.MathUtils.clamp(amount, 0, 1);
      pieces.forEach(piece => piece.mesh.position.copy(piece.rest).addScaledVector(piece.offset, value));
      root.updateMatrixWorld(true);
    },
  };
}
