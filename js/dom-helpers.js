/*
 * Small generic DOM helpers that don't belong to any one feature area.
 */

export function selectedValues(elements) {
  return new Set(
    elements
      .filter(element => element.checked)
      .map(element => element.value)
  );
}
