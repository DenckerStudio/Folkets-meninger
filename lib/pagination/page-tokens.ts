export type PageToken = number | 'gap';

export function getPageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const tokens: PageToken[] = [];
  for (let page = 1; page <= totalPages; page += 1) {
    const isEdge = page === 1 || page === totalPages;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;
    if (isEdge || isNearCurrent) {
      tokens.push(page);
    } else if (tokens[tokens.length - 1] !== 'gap') {
      tokens.push('gap');
    }
  }
  return tokens;
}