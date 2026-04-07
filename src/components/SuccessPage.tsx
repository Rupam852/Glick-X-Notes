import { motion } from 'motion/react';
import { CheckCircle, LogOut, User } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function SuccessPage() {
  const user = auth.currentUser;

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 p-8 text-center"
      >
        <div className="flex justify-center mb-6">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            className="p-4 bg-green-100 rounded-full"
          >
            <CheckCircle className="w-12 h-12 text-green-600" />
          </motion.div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Successfully Logged In!</h1>
        <p className="text-slate-500 mb-8">Welcome back to AuthHub. You have successfully authenticated.</p>

        <div className="bg-slate-50 rounded-xl p-6 mb-8 border border-slate-100 flex items-center gap-4 text-left">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account</p>
            <p className="text-slate-900 font-semibold truncate max-w-[200px]">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </motion.div>
    </div>
  );
}
