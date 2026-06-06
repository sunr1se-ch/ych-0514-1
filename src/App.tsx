import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import BatchDetail from "@/pages/BatchDetail";
import Review from "@/pages/Review";
import Layout from "@/components/Layout";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/batch/:id" element={<BatchDetail />} />
          <Route path="/review" element={<Review />} />
        </Routes>
      </Layout>
    </Router>
  );
}
