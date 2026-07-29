import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NewTradeFab() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const formOpen = pathname === '/journal' && search.includes('new=1')

  return (
    <AnimatePresence>
      {!formOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="fixed bottom-24 right-5 z-40 md:bottom-6 md:right-6"
        >
          <Button
            size="lg"
            className="h-11 rounded-full px-5 shadow-lg shadow-black/40"
            onClick={() => navigate('/journal?new=1')}
          >
            <Plus className="h-4 w-4" />
            Log trade
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
