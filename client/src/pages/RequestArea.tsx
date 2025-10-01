import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { Home } from "lucide-react";
import MapDraw, { MapDrawRef, type MapSnapshot } from "@/components/MapDraw";
import pokevisionLogo from "@assets/image6555_1758124202791.png";

interface GeofenceData {
  type: 'square' | 'polygon';
  area: number; // in km²
  coordinates: string[]; // lat,lng format
  imageData: string; // base64 image
}

interface GeofenceCollection {
  geofences: GeofenceData[];
  totalArea: number;
  totalCost: number;
}

type PricingTier = 'shadows-raids' | 'pokemon-pvp';

interface SubmitFormData {
  discordUsername: string;
  areaName: string;
  questions: string;
  pricingTier: PricingTier;
}

interface SubmitPayload {
  formData: SubmitFormData;
  geofenceCollection: GeofenceCollection & { formattedCoordinates: string };
}

interface DiscordSessionUser {
  id: string;
  username: string;
  discriminator?: string | null;
  globalName?: string | null;
  avatar?: string | null;
}

interface StoredState {
  snapshot?: MapSnapshot | null;
  formData?: {
    areaName?: string;
    questions?: string;
    pricingTier?: PricingTier;
  };
}

const RESTORE_STORAGE_KEY = "pv-request-area-state";

const formatDiscordDisplayName = (user: DiscordSessionUser | null): string => {
  if (!user) {
    return "";
  }

  if (user.globalName && user.globalName.trim().length > 0) {
    return user.globalName.trim();
  }

  return user.discriminator ? `${user.username}#${user.discriminator}` : user.username;
};

const RequestArea = () => {
  const [geofenceCollection, setGeofenceCollection] = useState<GeofenceCollection>({
    geofences: [],
    totalArea: 0,
    totalCost: 0
  });
  const [shouldClearCanvas, setShouldClearCanvas] = useState(false);
  const mapRef = useRef<MapDrawRef>(null);
  const [formData, setFormData] = useState<SubmitFormData>({
    discordUsername: '',
    areaName: '',
    questions: '',
    pricingTier: 'shadows-raids',
  });
  const isPokemonTier = formData.pricingTier === 'pokemon-pvp';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [coverageCounts, setCoverageCounts] = useState({ gyms: 0, pokestops: 0 });
  const [showGyms, setShowGyms] = useState(true);
  const [showPokestops, setShowPokestops] = useState(true);
  const [authUser, setAuthUser] = useState<DiscordSessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const pendingRestoreRef = useRef<StoredState | null>(null);

  const sanitizeAlphaNumSpace = useCallback((value: string) => value.replace(/[^a-zA-Z0-9 ]/g, ''), []);

  const tierSummaries = [
    {
      id: 'shadows-raids' as const,
      title: 'Pokestops and Gyms',
      rate: '$10 per 100km²',
      description:
        "Pokéstops (Invasions, Lures, Event Stops, Showcases), Gyms (Raids), Weather, Routes, Wayfarer, Submission Cells",
    },
    {
      id: 'pokemon-pvp' as const,
      title: 'Pokemon and Quests',
      rate: '$15 per 5km²',
      description:
        "Pokémon IVs (including Hundos), PvP rankings, Quests, Nests, Spawnpoints. Includes everything from Pokestops and Gyms.",
    },
  ];

  const calculateCost = (area: number, tier: string): number => {
    if (tier === 'shadows-raids') {
      // $10 per 100km²
      return Math.ceil(area / 100) * 10;
    } else {
      // Pokemon PVP: $15 per 5km²
      return Math.ceil(area / 5) * 15;
    }
  };

  const formatArea = (area: number): string => {
    return area.toFixed(2);
  };

  const handleShapeComplete = useCallback((shape: any) => {
    if (shape.type === 'sync') {
      // Handle sync from delete/edit operations
      const geofences = shape.geofences || [];
      const totalArea = geofences.reduce((sum: number, g: any) => sum + g.area, 0);
      const totalCost = calculateCost(totalArea, formData.pricingTier);
      
      setGeofenceCollection({
        geofences,
        totalArea,
        totalCost
      });
      return;
    }

    if (shape.area === 0 || !shape.coordinates || shape.coordinates.length === 0) {
      // This is a clear/reset event, don't add to collection
      return;
    }

    const newGeofence: GeofenceData = {
      type: shape.type,
      area: shape.area,
      coordinates: shape.coordinates || [],
      imageData: shape.imageData || ''
    };

    setGeofenceCollection(prev => {
      const updatedGeofences = [...prev.geofences, newGeofence];
      const totalArea = updatedGeofences.reduce((sum, g) => sum + g.area, 0);
      const totalCost = calculateCost(totalArea, formData.pricingTier);
      
      return {
        geofences: updatedGeofences,
        totalArea,
        totalCost
      };
    });
    
    setShouldClearCanvas(false);
  }, [formData.pricingTier]);

  const handleTierToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      pricingTier: checked ? 'pokemon-pvp' : 'shadows-raids',
    }));
  };

  const handleClearArea = () => {
    setGeofenceCollection({
      geofences: [],
      totalArea: 0,
      totalCost: 0
    });
    setCoverageCounts({ gyms: 0, pokestops: 0 });
    if (mapRef.current) {
      mapRef.current.clearMap();
    }
  };

  const handleCanvasClear = useCallback(() => {
    setShouldClearCanvas(false);
    setCoverageCounts({ gyms: 0, pokestops: 0 });
  }, []);

  // Recalculate cost when pricing tier changes
  useEffect(() => {
    if (geofenceCollection.totalArea > 0) {
      const newCost = calculateCost(geofenceCollection.totalArea, formData.pricingTier);
      setGeofenceCollection(prev => ({
        ...prev,
        totalCost: newCost
      }));
    }
  }, [formData.pricingTier, geofenceCollection.totalArea]);

  const formatCoordinatesForDiscord = () => {
    return geofenceCollection.geofences
      .map((geofence) => geofence.coordinates.join('\n'))
      .join('\n\n');
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchAuthSession = useCallback(async () => {
    try {
      setAuthLoading(true);
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Session request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.authenticated && data.user) {
        setAuthUser({
          id: data.user.id,
          username: data.user.username,
          discriminator: data.user.discriminator,
          globalName: data.user.globalName,
          avatar: data.user.avatar,
        });
      } else {
        setAuthUser(null);
      }
    } catch (error) {
      console.error('Failed to load Discord session', error);
      setAuthUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAuthSession();
  }, [fetchAuthSession]);

  useEffect(() => {
    const handle = formatDiscordDisplayName(authUser);
    setFormData((prev) => {
      if (prev.discordUsername === handle) {
        return prev;
      }
      return {
        ...prev,
        discordUsername: handle,
      };
    });
  }, [authUser]);

  const restorePendingState = useCallback(() => {
    const raw = sessionStorage.getItem(RESTORE_STORAGE_KEY);
    if (!raw) {
      return;
    }

    sessionStorage.removeItem(RESTORE_STORAGE_KEY);

    try {
      const stored: StoredState = JSON.parse(raw);

      if (stored.formData) {
        const { areaName, questions, pricingTier } = stored.formData;
        setFormData((prev) => ({
          ...prev,
          areaName: areaName ? sanitizeAlphaNumSpace(areaName) : '',
          questions: questions ? sanitizeAlphaNumSpace(questions) : '',
          pricingTier: pricingTier ?? prev.pricingTier,
        }));
      }

      if (stored.snapshot) {
        pendingRestoreRef.current = stored;

        if (mapReady && mapRef.current?.loadSnapshot) {
          mapRef.current.loadSnapshot(stored.snapshot);
          pendingRestoreRef.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to restore pending request state', error);
      pendingRestoreRef.current = null;
    }
  }, [mapReady, sanitizeAlphaNumSpace]);

  useEffect(() => {
    if (!authLoading) {
      restorePendingState();
    }
  }, [authLoading, restorePendingState]);

  useEffect(() => {
    if (pendingRestoreRef.current?.snapshot && mapReady && mapRef.current?.loadSnapshot) {
      mapRef.current.loadSnapshot(pendingRestoreRef.current.snapshot);
      pendingRestoreRef.current = null;
    }
  }, [mapReady]);

  useEffect(() => {
    return () => {
      setMapReady(false);
      pendingRestoreRef.current = null;
    };
  }, []);

  const handleDiscordLogin = () => {
    try {
      const snapshot = mapRef.current?.getSnapshot();
      const stateToPersist: StoredState = {
        snapshot: snapshot ?? null,
        formData: {
          areaName: formData.areaName,
          questions: formData.questions,
          pricingTier: formData.pricingTier,
        },
      };
      sessionStorage.setItem(RESTORE_STORAGE_KEY, JSON.stringify(stateToPersist));
    } catch (error) {
      console.error('Failed to persist request state before Discord login', error);
    }

    window.location.href = '/auth/discord';
  };

  const handleDiscordLogout = async () => {
    try {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to log out from Discord', error);
    } finally {
      sessionStorage.removeItem(RESTORE_STORAGE_KEY);
      await fetchAuthSession();
    }
  };

  const submitWithRetry = async (
    payload: SubmitPayload,
    onSuccess: () => void,
    maxRetries: number = 5,
  ): Promise<void> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      setRetryAttempt(attempt);
      
      try {
        const response = await fetch('/api/request-area', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Timestamp': Date.now().toString()
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          onSuccess();
          return;
        } 
        
        // If we get a 500 error and haven't reached max retries, continue to retry
        if (response.status === 500 && attempt < maxRetries) {
          console.log(`Attempt ${attempt} failed with 500 error, retrying in 3 seconds...`);
          await sleep(3000); // Wait 3 seconds before retry
          continue;
        }
        
        // For non-500 errors or final attempt, show error and stop
        alert(`Failed to submit request: ${result.error || 'Unknown error'}`);
        return;
        
      } catch (error) {
        // Network error or other exception
        if (attempt < maxRetries) {
          console.log(`Attempt ${attempt} failed with network error, retrying in 3 seconds...`);
          await sleep(3000);
          continue;
        }
        
        // Final attempt failed
        alert('Failed to submit request. Please check your connection and try again.');
        return;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authUser) {
      alert('Please sign in with Discord before submitting a request.');
      return;
    }

    if (geofenceCollection.geofences.length === 0) {
      alert('Please draw at least one area on the map.');
      return;
    }

    if (!formData.areaName.trim()) {
      alert('Please provide an area name.');
      return;
    }

    if (isSubmitting) {
      return; // Prevent multiple simultaneous submissions
    }

    setIsSubmitting(true);
    setRetryAttempt(0);
    const discordHandle = formatDiscordDisplayName(authUser);
    const payload: SubmitPayload = {
      formData: {
        ...formData,
        discordUsername: discordHandle,
        areaName: formData.areaName.trim(),
        questions: formData.questions.trim(),
      },
      geofenceCollection: {
        ...geofenceCollection,
        formattedCoordinates: formatCoordinatesForDiscord(),
      },
    };
    const handleSuccess = () => {
      alert('Request submitted successfully! We will contact you via Discord soon.');
      sessionStorage.removeItem(RESTORE_STORAGE_KEY);
      setFormData({
        discordUsername: discordHandle,
        areaName: '',
        questions: '',
        pricingTier: 'shadows-raids',
      });
      setGeofenceCollection({
        geofences: [],
        totalArea: 0,
        totalCost: 0,
      });
      setCoverageCounts({ gyms: 0, pokestops: 0 });
      setShouldClearCanvas(true);
    };
    
    try {
      await submitWithRetry(payload, handleSuccess);
    } finally {
      setIsSubmitting(false);
      setRetryAttempt(0);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-card-border bg-card/30">
        <div className="container mx-auto max-w-6xl px-4 lg:px-8 py-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img 
                src={pokevisionLogo} 
                alt="PokéVision Logo" 
                className="h-10 w-auto"
                data-testid="logo-main"
              />
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                  Request An <span className="metallic-gold">Area</span>
                </h1>
                <p className="text-muted-foreground mt-2">
                  Define your area of interest and get a custom quote for PokéVision coverage.
                </p>
              </div>
            </div>
            <Link href="/">
              <Button 
                variant="outline" 
                size="lg"
                className="metallic-gold-border text-foreground hover:bg-primary/10 text-base px-8 py-3 flex items-center gap-2"
                data-testid="button-back-home"
              >
                <Home className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 lg:px-8 py-8 space-y-8">
        {/* Map Section - Full Width */}
        <Card className="subtle-gold-gradient">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  size="lg"
                  onClick={handleClearArea}
                  className="metallic-gold-bg text-black hover:opacity-90 text-base px-8 py-3 font-semibold"
                  data-testid="button-clear-area"
                >
                  Clear Area
                </Button>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                  <CardTitle>Map Preview</CardTitle>
                  <div className="flex flex-col gap-2 text-xs sm:text-sm text-muted-foreground">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={showGyms}
                        onCheckedChange={(checked) => setShowGyms(checked === true)}
                        aria-label="Toggle gyms visibility"
                      />
                      <span>
                        Enabled Gyms Covered:
                        {' '}
                        <span className="font-semibold text-foreground">{showGyms ? coverageCounts.gyms : 0}</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={showPokestops}
                        onCheckedChange={(checked) => setShowPokestops(checked === true)}
                        aria-label="Toggle pokestops visibility"
                      />
                      <span>
                        Enabled Pokestops Covered:
                        {' '}
                        <span className="font-semibold text-foreground">{showPokestops ? coverageCounts.pokestops : 0}</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="ml-auto flex flex-col items-end gap-3 text-right">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Estimated Cost
                  </p>
                  <p className="text-2xl font-semibold metallic-gold">
                    ${geofenceCollection.totalCost}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Toggle pricing structure
                  </span>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <span className={`${!isPokemonTier ? 'font-semibold text-[#D4AF37]' : ''}`}>
                      Pokestops & Gyms
                    </span>
                    <Switch
                      checked={isPokemonTier}
                      onCheckedChange={handleTierToggle}
                      className="border border-card-border bg-[#D4AF37] data-[state=unchecked]:bg-[#D4AF37] data-[state=checked]:bg-[#D4AF37] shadow-inner"
                      thumbClassName="bg-black"
                      data-testid="toggle-pricing-tier"
                      aria-label="Toggle pricing tier"
                    />
                    <span className={`${isPokemonTier ? 'font-semibold text-[#D4AF37]' : ''}`}>
                      Pokemon & Quests
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="w-full">
                <MapDraw
                  ref={mapRef}
                  onShapeComplete={handleShapeComplete}
                  onClear={handleCanvasClear}
                  shouldClear={shouldClearCanvas}
                  onCoverageChange={setCoverageCounts}
                  showGyms={showGyms}
                  showPokestops={showPokestops}
                  onReady={() => setMapReady(true)}
                />
              </div>
              
              {geofenceCollection.geofences.length > 0 && (
                <div className="p-3 bg-card/50 rounded border border-card-border space-y-2">
                  <div className="text-sm space-y-1">
                    {geofenceCollection.geofences.map((geofence, index) => (
                      <div key={index} className="flex justify-between">
                        <span>Geofence {index + 1}:</span>
                        <span>{formatArea(geofence.area)} km²</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Area:</span>
                      <span>{formatArea(geofenceCollection.totalArea)} km²</span>
                    </div>
                    <div className="flex justify-between metallic-gold font-semibold">
                      <span>Total Cost:</span>
                      <span>${geofenceCollection.totalCost}</span>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          </CardContent>
        </Card>

        {/* Form Section - Full Width Below Map */}
        <Card className="subtle-gold-gradient">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Request Details</CardTitle>
              <div className="flex items-center gap-3">
                {authUser ? (
                  <>
                    <span className="text-sm text-muted-foreground">
                      Signed in as{' '}
                      <span className="font-semibold text-foreground">
                        {formatDiscordDisplayName(authUser)}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDiscordLogout}
                      disabled={authLoading}
                      data-testid="button-discord-logout"
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleDiscordLogin}
                    disabled={authLoading}
                    className="metallic-gold-border text-foreground hover:bg-primary/10"
                    data-testid="button-discord-login"
                  >
                    {authLoading ? 'Loading...' : 'Sign in with Discord'}
                  </Button>
                )}
              </div>
            </div>
            {!authUser && !authLoading && (
              <p className="text-xs text-muted-foreground">
                Sign in with Discord to submit a request. We use your Discord identity to contact you.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="areaName">Area Name *</Label>
                  <Input
                    id="areaName"
                    value={formData.areaName}
                    onChange={(e) => {
                      const sanitized = sanitizeAlphaNumSpace(e.target.value);
                      setFormData(prev => ({ ...prev, areaName: sanitized }));
                    }}
                    placeholder="Downtown Poke Stops"
                    required
                    data-testid="input-area-name"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Pricing Tier *</Label>
                  <span className="text-xs text-muted-foreground">
                    Use the toggle above to switch plans.
                  </span>
                </div>
                <div className="grid gap-3">
                  {tierSummaries.map((tier) => (
                    <div
                      key={tier.id}
                      className={`rounded-lg border p-4 text-sm transition-colors ${
                        formData.pricingTier === tier.id
                          ? 'border-primary/60 bg-card/80 shadow-sm'
                          : 'border-card-border bg-card/40'
                      }`}
                    >
                      <p className="font-semibold text-foreground">
                        {tier.title} — {tier.rate}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {tier.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="questions">Questions or Special Requests</Label>
                <Textarea
                  id="questions"
                  value={formData.questions}
                  onChange={(e) => {
                    const sanitized = sanitizeAlphaNumSpace(e.target.value);
                    setFormData(prev => ({ ...prev, questions: sanitized }));
                  }}
                  placeholder="Any questions or special requests for this area..."
                  className="min-h-24"
                  data-testid="input-questions"
                />
              </div>

              {geofenceCollection.geofences.length > 0 && (
                <Card className="bg-card/50 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-foreground">Selected Areas Summary</h3>
                      <div className="text-sm text-muted-foreground space-y-2">
                        {geofenceCollection.geofences.map((geofence, index) => (
                          <div key={index} className="border-b pb-2 last:border-b-0">
                            <p><strong>Geofence {index + 1}:</strong> {geofence.type.charAt(0).toUpperCase() + geofence.type.slice(1)}</p>
                            <p>Area: {formatArea(geofence.area)} km²</p>
                          </div>
                        ))}
                        <div className="pt-2 border-t">
                          <p className="text-base font-semibold text-foreground">
                            Total Area: {formatArea(geofenceCollection.totalArea)} km²
                          </p>
                          <p className="text-lg font-semibold metallic-gold">
                            Total Estimated Cost: ${geofenceCollection.totalCost}
                          </p>
                          <p className="text-xs">
                            {formData.pricingTier === 'shadows-raids' 
                              ? `Pokestops and Gyms: $10 per 100km² (${Math.ceil(geofenceCollection.totalArea / 100)} tier${Math.ceil(geofenceCollection.totalArea / 100) > 1 ? 's' : ''})`
                              : `Pokemon and Quests: $15 per 5km² (${Math.ceil(geofenceCollection.totalArea / 5)} tier${Math.ceil(geofenceCollection.totalArea / 5) > 1 ? 's' : ''})`
                            }
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium text-foreground">All Coordinates:</h4>
                        <div className="bg-background/50 rounded p-2 max-h-32 overflow-y-auto">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{formatCoordinatesForDiscord()}</pre>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button 
                type="submit" 
                className="w-full metallic-gold-bg text-black hover:opacity-90 font-semibold"
                disabled={
                  geofenceCollection.geofences.length === 0 ||
                  isSubmitting ||
                  authLoading ||
                  !authUser
                }
                data-testid="button-submit-request"
              >
                {isSubmitting ? (
                  retryAttempt > 1 ? 
                    `Retrying... (${retryAttempt}/5)` : 
                    'Submitting...'
                ) : (
                  'Submit Request'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                * Required fields. We'll review your request and contact you within 24 hours.
              </p>
              </form>
            </CardContent>
          </Card>
      </div>
    </div>
  );
};

export default RequestArea;
