export const formatSize = (b) => {
  if (!b) return '0 B'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB'
  return (b/1073741824).toFixed(2) + ' GB'
}

export const formatDate = (s) => {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}

export const fileTypeInfo = (ext, mime='') => {
  const m = mime.toLowerCase()
  if (m.startsWith('image/'))  return { color:'text-blue-400',   bg:'bg-blue-400/10',   label:'Image' }
  if (m.startsWith('video/'))  return { color:'text-purple-400', bg:'bg-purple-400/10', label:'Video' }
  if (m.startsWith('audio/'))  return { color:'text-pink-400',   bg:'bg-pink-400/10',   label:'Audio' }
  const e = (ext||'').toLowerCase()
  if (e === 'pdf')                          return { color:'text-red-400',    bg:'bg-red-400/10',    label:'PDF' }
  if (['doc','docx'].includes(e))           return { color:'text-blue-300',   bg:'bg-blue-300/10',   label:'Word' }
  if (['xls','xlsx','csv'].includes(e))     return { color:'text-green-400',  bg:'bg-green-400/10',  label:'Excel' }
  if (['zip','rar','7z','tar'].includes(e)) return { color:'text-yellow-400', bg:'bg-yellow-400/10', label:'Archive' }
  if (['py','js','ts','jsx'].includes(e))   return { color:'text-cyan-400',   bg:'bg-cyan-400/10',   label:'Code' }
  return { color:'text-zinc-400', bg:'bg-zinc-400/10', label:(ext||'File').toUpperCase() }
}

// Global thumbnail cache
export const thumbCache = {}
