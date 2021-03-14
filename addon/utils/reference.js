export function isModelReference(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    'type' in value
  );
}
