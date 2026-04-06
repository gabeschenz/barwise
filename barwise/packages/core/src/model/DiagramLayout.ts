/**
 * A persisted diagram layout. Stores user-arranged positions for
 * entity types and orientation overrides for fact types.
 *
 * Coordinates are integer pixels in screen convention:
 * (0,0) at top-left, x increases right, y increases down.
 */
export interface DiagramLayout {
  /** Display name for this diagram view. */
  readonly name: string;
  /**
   * Entity type positions, keyed by object type name.
   * Values are {x, y} in integer pixels.
   */
  readonly positions: Readonly<Record<string, { x: number; y: number }>>;
  /**
   * Fact type orientation overrides, keyed by fact type name.
   * Only includes fact types where the user explicitly set orientation.
   */
  readonly orientations: Readonly<Record<string, "horizontal" | "vertical">>;
}
