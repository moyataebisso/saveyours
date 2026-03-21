'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Send, Clock, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'

interface ChangeRequest {
  id: string
  request_type: string
  description: string
  status: string
  priority: string
  admin_notes: string | null
  created_at: string
}

const REQUEST_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'content_update', label: 'Content Update' },
  { value: 'design_change', label: 'Design Change' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'new_feature', label: 'New Feature' },
  { value: 'urgent_fix', label: 'Urgent Fix' },
]

export default function ChangeRequestsPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Form state
  const [requestType, setRequestType] = useState('general')
  const [priority, setPriority] = useState('normal')
  const [description, setDescription] = useState('')

  const ADMIN_PASSWORD = 'SaveYours2024!'
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000

  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(fetchRequests, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  const checkAuthentication = () => {
    const isAdmin = localStorage.getItem('adminAuthenticated')
    const authTime = localStorage.getItem('adminAuthTime')

    if (isAdmin === 'true' && authTime) {
      const sessionAge = Date.now() - parseInt(authTime)
      if (sessionAge > SESSION_TIMEOUT) {
        localStorage.removeItem('adminAuthenticated')
        localStorage.removeItem('adminAuthTime')
        setIsAuthenticated(false)
        toast.info('Session expired. Please login again.')
        setLoading(false)
      } else {
        setIsAuthenticated(true)
        fetchRequests()
      }
    } else {
      setLoading(false)
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('adminAuthenticated', 'true')
      localStorage.setItem('adminAuthTime', Date.now().toString())
      setIsAuthenticated(true)
      fetchRequests()
      toast.success('Login successful')
    } else {
      toast.error('Invalid password')
    }
  }

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/change-requests/list')
      const data = await res.json()
      if (data.requests) {
        setRequests(data.requests)
      }
    } catch {
      console.error('Failed to fetch requests')
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage('')
    setErrorMessage('')

    if (description.trim().length < 10) {
      setErrorMessage('Please describe your request (at least 10 characters)')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/change-requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, requestType, priority }),
      })
      const data = await res.json()

      if (res.ok) {
        setSuccessMessage('Request submitted successfully!')
        setDescription('')
        setRequestType('general')
        setPriority('normal')
        setShowForm(false)
        fetchRequests()
      } else {
        setErrorMessage(data.error || 'Failed to submit request')
      }
    } catch {
      setErrorMessage('Failed to submit request. Please try again.')
    }
    setSubmitting(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" /> Pending
          </span>
        )
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
            <Loader2 className="w-3 h-3" /> In Progress
          </span>
        )
      case 'done':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" /> Done
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const getTypeBadge = (type: string) => {
    const label = REQUEST_TYPES.find(t => t.value === type)?.label || type
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
        {label}
      </span>
    )
  }

  const getPriorityBadge = (p: string) => {
    if (p === 'urgent') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-100 text-red-800">
          <AlertTriangle className="w-3 h-3" /> Urgent
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
        Normal
      </span>
    )
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
            <div>
              <h1 className="text-2xl font-bold">Change Requests</h1>
              <p className="text-sm text-gray-500">
                Request changes to SaveYours. Managed by Arsi Technology Group.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setSuccessMessage('')
              setErrorMessage('')
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* New Request Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Submit a Change Request</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Request Type</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {REQUEST_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="normal"
                      checked={priority === 'normal'}
                      onChange={(e) => setPriority(e.target.value)}
                      className="text-primary-600"
                    />
                    Normal
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="urgent"
                      checked={priority === 'urgent'}
                      onChange={(e) => setPriority(e.target.value)}
                      className="text-red-600"
                    />
                    Urgent
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you'd like changed (at least 10 characters)..."
                  rows={5}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-400 mt-1">{description.length}/10 minimum characters</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Request
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Requests List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Your Requests ({requests.length})
          </h2>

          {requests.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <p>No change requests yet.</p>
              <p className="text-sm mt-1">Click &quot;+ New Request&quot; to submit one.</p>
            </div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {getTypeBadge(req.request_type)}
                  {getPriorityBadge(req.priority)}
                  {getStatusBadge(req.status)}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(req.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{req.description}</p>
                {req.admin_notes && req.status === 'done' && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-1">Admin Notes:</p>
                    <p className="text-sm text-green-700 whitespace-pre-wrap">{req.admin_notes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
