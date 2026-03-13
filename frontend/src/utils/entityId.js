/**
 * Entity ID helper - supports both PostgreSQL (id) and legacy (_id) formats
 */
export const getId = (entity) => {
  if (!entity) return null;
  return entity.id ?? entity._id ?? null;
};
