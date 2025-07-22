import "./App.scss";
import Navigation from "./Navigation";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Account from "./Account";
import { AuthProvider } from "./use-auth-client";
import CreateSwap from "./SwapForm";
import SwapList from "./SwapList";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <h1>SwapX</h1>
        <Navigation />
        <div className="content">
          <Routes>
            <Route path="/" element={<SwapList />} />
            <Route path="/newSwap" element={<CreateSwap />} />
            <Route path="/myAccount" element={<Account />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
