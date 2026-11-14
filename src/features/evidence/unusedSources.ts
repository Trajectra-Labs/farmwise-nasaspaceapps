export type UnusedSource = {
  id: string
  name: string
  adds: string
  linkText: string
  href: string
}

/** Optional NASA products. None of them is retrieved or used by FarmWise, so no values are shown. */
export const UNUSED_SOURCES: UnusedSource[] = [
  {
    id: 'smap',
    name: 'SMAP',
    adds: 'Would add satellite soil moisture for the wider region. It would still not be a test of your own soil.',
    linkText: 'About the NASA SMAP mission',
    href: 'https://smap.jpl.nasa.gov/',
  },
  {
    id: 'gpm',
    name: 'GPM IMERG',
    adds: 'Would add satellite rainfall estimates on a finer grid than the POWER monthly series.',
    linkText: 'About the NASA GPM mission',
    href: 'https://gpm.nasa.gov/',
  },
  {
    id: 'modis',
    name: 'MODIS',
    adds: 'Would add how green the land looked from space, a rough sign of vegetation over time.',
    linkText: 'About the MODIS instrument (NASA Earthdata)',
    href: 'https://www.earthdata.nasa.gov/data/instruments/modis',
  },
  {
    id: 'landsat',
    name: 'Landsat',
    adds: 'Would add finer-detail satellite images of fields and vegetation.',
    linkText: 'About the NASA Landsat program',
    href: 'https://landsat.gsfc.nasa.gov/',
  },
  {
    id: 'ecostress',
    name: 'ECOSTRESS',
    adds: 'Would add land surface temperature and plant water use estimates from the International Space Station.',
    linkText: 'About the NASA ECOSTRESS mission',
    href: 'https://ecostress.jpl.nasa.gov/',
  },
]
