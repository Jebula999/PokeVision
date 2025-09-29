import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PricingBanner = () => {
  return (
    <section className="w-full py-16 bg-card/30">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Basic Plan */}
          <Card 
            className="metallic-gold-border bg-card/50 hover:bg-card/70 transition-colors cursor-pointer"
            onClick={() => window.open('https://ko-fi.com/pokevision', '_blank', 'noopener,noreferrer')}
            data-testid="card-shadows-raids"
          >
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center px-4 py-2 rounded-full metallic-gold-border mx-auto mb-2">
                <span className="text-2xl font-bold metallic-gold">$10</span>
              </div>
              <CardTitle className="text-xl">per 100km²</CardTitle>
              <p className="text-lg font-semibold text-foreground">Shadows and Raids</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Pokéstops</li>
                <li className="ml-4">• Invasions</li>
                <li className="ml-4">• Lures</li>
                <li className="ml-4">• Event Stops</li>
                <li className="ml-4">• Showcases</li>
                <li>• Gyms</li>
                <li className="ml-4">• Raids</li>
                <li>• Weather</li>
                <li>• Routes</li>
                <li>• Wayfarer</li>
                <li>• Submission Cells</li>
              </ul>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card 
            className="metallic-gold-border bg-card/50 hover:bg-card/70 transition-colors relative cursor-pointer"
            onClick={() => window.open('https://ko-fi.com/pokevision', '_blank', 'noopener,noreferrer')}
            data-testid="card-pokemon-pvp"
          >
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center px-4 py-2 rounded-full metallic-gold-border mx-auto mb-2">
                <span className="text-2xl font-bold metallic-gold">$15</span>
              </div>
              <CardTitle className="text-xl">per 5km²</CardTitle>
              <p className="text-lg font-semibold text-foreground">Pokémon, PVP and Quests</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Pokémon IVs (Including Hundo's)</li>
                <li>• PvP Rankings</li>
                <li>• Quests</li>
                <li>• Nests</li>
                <li>• Spawnpoints</li>
              </ul>
              <div className="pt-2 border-t border-card-border">
                <p className="text-sm font-semibold text-foreground mb-2">Includes:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Shadows and Raids</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Global Plan */}
          <Card 
            className="metallic-gold-border bg-card/50 hover:bg-card/70 transition-colors cursor-pointer"
            onClick={() => window.open('https://ko-fi.com/pokevision', '_blank', 'noopener,noreferrer')}
            data-testid="card-global-access"
          >
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center px-4 py-2 rounded-full metallic-gold-border mx-auto mb-2">
                <span className="text-2xl font-bold metallic-gold">$50</span>
              </div>
              <CardTitle className="text-xl">per Month</CardTitle>
              <p className="text-lg font-semibold text-foreground">Global Access</p>
              <p className="text-sm text-muted-foreground">(Does Not Include A Custom Area)</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Global Map Access</li>
                <li>• Global Scan-On-Demand</li>
                <li>• Custom Notifications</li>
              </ul>
              <div className="pt-2 border-t border-card-border">
                <p className="text-sm font-semibold text-foreground mb-2">Includes:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Shadows and Raids</li>
                  <li>• Pokémon, PVP and Quests</li>
                </ul>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </section>
  );
};

export default PricingBanner;