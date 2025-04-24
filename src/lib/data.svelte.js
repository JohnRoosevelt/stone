export const DATAS = $state({
  online: false,
  isDarkMode: false,
  showSdaEnglish: false,
  isOpenSdaSeting: false,
})

export const DIALOG = $state({
  SX: { show: false, l: true, animate: {}, c: null },
  SY: { show: false, b: true, animate: {}, c: null },
  SC: { show: false, animate: {}, c: null },
})

export const TOUCHP = $state({})