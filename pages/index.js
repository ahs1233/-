import { useEffect, useState } from 'react'

export default function Home() {
  const [provinces, setProvinces] = useState([])

  useEffect(() => {
    fetch('http://localhost:4000/provinces')
      .then(res => res.json())
      .then(data => setProvinces(data))
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 text-right p-8 font-sans">
      <h1 className="text-3xl font-bold mb-6">اختر محافظتك</h1>
      <div className="grid grid-cols-1 gap-4">
        {provinces.map(p => (
          <a key={p.id} href={`/province/${p.id}`} className="block bg-white p-4 rounded shadow hover:bg-gray-200">
            {p.name_ar}
          </a>
        ))}
      </div>
    </div>
  )
}
