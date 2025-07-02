import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function Province() {
  const router = useRouter()
  const { id } = router.query
  const [sections, setSections] = useState([])

  useEffect(() => {
    if (id) {
      fetch(`http://localhost:4000/provinces/${id}/sections`)
        .then(res => res.json())
        .then(data => setSections(data))
    }
  }, [id])

  return (
    <div className="min-h-screen bg-gray-50 text-right p-6">
      <h1 className="text-2xl font-bold mb-4">أقسام السوق</h1>
      <ul className="space-y-3">
        {sections.map(sec => (
          <li key={sec.id} className="bg-white p-4 rounded shadow">
            <a href={`/section/${sec.id}`}>{sec.name_ar}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
