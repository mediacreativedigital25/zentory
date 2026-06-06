import { Search, Bell } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 px-6 border-b border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex items-center justify-between shrink-0 font-sans backdrop-blur-md sticky top-0 z-10 w-full">
      <div className="flex-1 flex items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search resources, users, or settings..." 
            className="w-full bg-slate-100 dark:bg-slate-800/50 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-0 text-sm rounded-full pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 outline-none transition-all"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900"></span>
        </button>
        <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden border-2 border-white dark:border-slate-800 cursor-pointer">
          <img src="https://i.pravatar.cc/150?u=admin" alt="Profile" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
}
