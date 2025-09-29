const Features = () => {
  const features = [
    {
      title: "Personalized Areas",
      description: "Custom location feeds tailored to your needs.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 9 5.16.74 9-3.45 9-9V7l-10-5z" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      )
    },
    {
      title: "Real-Time Data",
      description: "Up-to-date info and alerts.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      )
    },
    {
      title: "Discord Support",
      description: "Get help and updates through our Discord server.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path d="M16 4H8C6.9 4 6 4.9 6 6v10c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="9" cy="9" r="1" fill="currentColor"/>
          <circle cx="15" cy="9" r="1" fill="currentColor"/>
          <path d="M9 13c1 1 2 1 3 1s2 0 3-1" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      )
    },
    {
      title: "Transparent Pricing",
      description: "Transparent pricing.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <line x1="12" x2="12" y1="1" y2="23" stroke="currentColor" strokeWidth="2"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      )
    }
  ];

  return (
    <section className="w-full py-16 bg-card/20">
      <div className="container mx-auto max-w-6xl px-4 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Why choose <span className="metallic-gold">PokéVision</span>?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="flex items-start space-x-4 p-6 rounded-lg metallic-gold-border bg-card/50 hover:bg-card/70 transition-colors"
              data-testid={`feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 border border-primary/20">
                {feature.icon}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;