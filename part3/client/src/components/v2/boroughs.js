// Our own borough marks (never subway route letters) and their token colours.
export const BOROUGHS = {
  Manhattan: { code: 'MN', color: 'var(--borough-mn)' },
  Brooklyn: { code: 'BK', color: 'var(--borough-bk)' },
  Queens: { code: 'QN', color: 'var(--borough-qn)' },
  Bronx: { code: 'BX', color: 'var(--borough-bx)' },
  'Staten Island': { code: 'SI', color: 'var(--borough-si)' },
};

export const BOROUGH_NAMES = Object.keys(BOROUGHS);

export function boroughInfo(name) {
  return BOROUGHS[name] ?? { code: '··', color: 'var(--accent)' };
}
