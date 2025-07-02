import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function Section() {
  const router = useRouter()
  const { id } = router.query
  const [stores, setStores] = useState([])

  useEffect(() => {
    if (id) {
      fetch(`http://localhost:4000/sections/${id}/stores`)
        .then(res => res.json())
        .then(data => setStores(data))
    }
  }, [id])

  return (
    <div className="min-h-screen bg-gray-50 text-right p-6">
      <h1 className="text-2xl font-bold mb-4">المتاجر</h1>
      <ul className="space-y-3">
        {stores.map(store => (
          <li key={store.id} className="bg-white p-4 rounded shadow">
            <a href={`/store/${store.id}`}>{store.name}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
