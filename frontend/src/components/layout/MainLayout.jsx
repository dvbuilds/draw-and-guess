import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import { Footer } from './Footer.jsx';

export function MainLayout() {
  return (
    <div className="sketch-grid-bg flex min-h-screen w-full flex-col overflow-x-hidden">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
