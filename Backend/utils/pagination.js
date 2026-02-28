/**
 * Pagination Utility
 * 
 * Standardized pagination helper for consistent API responses.
 * 
 * Architecture decisions:
 * - Max limit of 100 to prevent memory issues
 * - Consistent response format across all endpoints
 * - Calculates total pages automatically
 */

/**
 * Parse and validate pagination parameters
 * @param {Object} query - Request query object
 * @param {Object} options - Default options
 * @returns {Object} Validated pagination params
 */
export const parsePagination = (query, options = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 20,
    maxLimit = 100
  } = options;

  let page = parseInt(query.page) || defaultPage;
  let limit = parseInt(query.limit) || defaultLimit;

  // Validate and constrain
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), maxLimit);

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build pagination metadata for response
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items count
 * @returns {Object} Pagination metadata
 */
export const buildPaginationMeta = (page, limit, total) => {
  const pages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1
  };
};

/**
 * Complete pagination helper
 * Combines parsing and metadata building
 */
export const paginate = async (Model, filter, query, options = {}) => {
  const { page, limit, skip } = parsePagination(query, options);
  const { select, sort = { createdAt: -1 }, populate } = options;

  // Build query
  let dbQuery = Model.find(filter);
  
  if (select) dbQuery = dbQuery.select(select);
  if (sort) dbQuery = dbQuery.sort(sort);
  if (populate) dbQuery = dbQuery.populate(populate);
  
  dbQuery = dbQuery.limit(limit).skip(skip).lean();

  // Execute queries in parallel
  const [items, total] = await Promise.all([
    dbQuery,
    Model.countDocuments(filter)
  ]);

  return {
    items,
    pagination: buildPaginationMeta(page, limit, total)
  };
};

export default {
  parsePagination,
  buildPaginationMeta,
  paginate
};
