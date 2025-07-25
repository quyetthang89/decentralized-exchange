import "./Navigation.scss";
import { Link } from "react-router-dom";
import { useAuth } from "./use-auth-client";
import { useNavigate } from "react-router-dom";

function Navigation() {
  const { isAuthenticated, login, logout, principal } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navigation">
      {isAuthenticated && (
        <div className="principal">
          Logged in as: {principal?.toString()}
        </div>
      )}
      <div className="menu">
        <div className="menu-item">
          <Link to="/">Browse Swaps</Link>
        </div>
        {isAuthenticated && (
          <div className="menu-item">
            <Link to="/newSwap">Create Swap</Link>
          </div>
        )}
        {isAuthenticated && (
          <div className="menu-item">
            <Link to="/myAccount">My Wallet</Link>
          </div>
        )}
        {!isAuthenticated ? (
          <div 
            className="menu-item-button sign-in" 
            onClick={login}
          >
            Sign In
          </div>
        ) : (
          <div
            className="menu-item-button sign-out"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            Sign Out
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navigation;
