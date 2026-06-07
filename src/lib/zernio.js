export async function postClipToSocial(clipBlob, caption, hashtags, platforms) {
  const formData = new FormData()
  formData.append('video', clipBlob, 'clip.mp4')
  formData.append('text', `${caption}\n\n${hashtags}`)
  platforms.forEach((p) => formData.append('platforms[]', p))

  const res = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_ZERNIO_API_KEY}`,
    },
    body: formData,
  })

  if (!res.ok) {
    throw new Error(`Zernio API error: ${res.status}`)
  }

  return await res.json()
}
