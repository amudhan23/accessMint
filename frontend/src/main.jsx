import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { WalletProvider } from "./components/WalletConnect.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <WalletProvider>
    <App />
  </WalletProvider>,
);
