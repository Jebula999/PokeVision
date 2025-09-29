import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CTACards = () => {
  const cards = [
    {
      title: "Join Discord",
      description: "Real-time updates via our Discord server.",
      buttonText: "Join Discord Server",
      buttonHref: "https://discord.gg/86pNbRzX4N",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path d="M16 4H8C6.9 4 6 4.9 6 6v10c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="9" cy="9" r="1" fill="currentColor"/>
          <circle cx="15" cy="9" r="1" fill="currentColor"/>
          <path d="M9 13c1 1 2 1 3 1s2 0 3-1" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      ),
      testId: "card-discord"
    },
    {
      title: "Explore Map",
      description: "Live updates in action.",
      buttonText: "View Map",
      buttonHref: "https://map.pokevision.co.za/",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      ),
      testId: "card-demo"
    },
    {
      title: "Sign Up Now",
      description: "Start or expand coverage in your areas.",
      buttonText: "Go to Ko-Fi",
      buttonHref: "https://ko-fi.com/pokevision",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      ),
      testId: "card-signup"
    }
  ];

  return (
    <section className="w-full py-16">
      <div className="container mx-auto max-w-6xl px-4 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <Card 
              key={index} 
              className="metallic-gold-border bg-card hover:bg-card/80 transition-all duration-200"
              data-testid={card.testId}
            >
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  {card.icon}
                </div>
                <CardTitle className="text-xl font-semibold text-foreground">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <CardDescription className="text-muted-foreground">
                  {card.description}
                </CardDescription>
                <Button 
                  asChild 
                  className="w-full metallic-gold-bg text-black hover:opacity-90 font-semibold"
                  data-testid={`button-${card.testId.replace('card-', '')}`}
                >
                  <a href={card.buttonHref} target="_blank" rel="noopener noreferrer">
                    {card.buttonText}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CTACards;