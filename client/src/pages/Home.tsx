import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import PricingBanner from "@/components/PricingBanner";
import CTACards from "@/components/CTACards";
import Features from "@/components/Features";
import Footer from "@/components/Footer";

const Home = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <PricingBanner />
        <CTACards />
        <Features />
      </main>
      <Footer />
    </div>
  );
};

export default Home;