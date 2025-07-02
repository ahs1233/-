import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function StorePage() {
  const router = useRouter()
  const { id } = router.query
  const [products, setProducts] = useState([])

  useEffect(() => {
    if (id) {
      fetch(`http://localhost:4000/stores/${id}/products`)
        .then(res => res.json())
        .then(data => setProducts(data))
    }
  }, [id])

  return (
    <div className="min-h-screen bg-gray-50 text-right p-6">
      <h1 className="text-2xl font-bold mb-4">المنتجات</h1>
      <ul className="space-y-3">
        {products.map(prod => (
          <li key={prod.id} className="bg-white p-4 rounded shadow">
            <div className="font-semibold">{prod.name}</div>
            <div className="text-sm text-gray-500">السعر: ${prod.price}</div>
            <button className="mt-2 bg-green-600 text-white px-4 py-1 rounded">اطلب الآن</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
