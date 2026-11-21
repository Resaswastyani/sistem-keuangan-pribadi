"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Activity, AlarmClock, Apple, Armchair, Award, Baby, Banknote, Bed, Bell, Bike, BookMarked, BookOpen, Brain, Briefcase, Building, Building2, Bus,
  Calendar, Camera, Car, CarFront, Cat, Church, Clock, Code, Coffee, Coins, CreditCard, Crown, Dog, Droplets, Dumbbell, Film, Flag, Flame, Flower2,
  Footprints, Fuel, Gamepad2, Gem, Gift, Globe, GraduationCap, Guitar, Hammer, HandCoins, Handshake, Headphones, Heart, HeartHandshake, Home, Hotel,
  KeyRound, Landmark, Laptop, Leaf, Library, Lightbulb, Map, MapPin, Medal, Mic, Monitor, Moon, Mountain, Music2, NotebookPen, Palette, Palmtree, PawPrint,
  Pencil, Piano, PiggyBank, Pill, Pizza, Plane, Rocket, Salad, Scale, School, Search, Ship, Shirt, ShoppingBag, Smartphone, Snowflake, Sofa, Sparkles,
  Sprout, Star, Stethoscope, Store, Sun, Target, Tent, TrainFront, TreePine, Trophy, Tv, Umbrella, Users, Utensils, Wallet, Watch, Wrench, Zap,
} from "lucide-react"
import { ICON_GROUPS } from "@/lib/icon-keys"

export const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles, star: Star, heart: Heart, target: Target, flag: Flag, rocket: Rocket, crown: Crown, bell: Bell, clock: Clock, alarm: AlarmClock, calendar: Calendar, pin: MapPin,
  graduation: GraduationCap, school: School, book: BookOpen, library: Library, bookmark: BookMarked, notebook: NotebookPen, pencil: Pencil, brain: Brain, lightbulb: Lightbulb, award: Award, trophy: Trophy, medal: Medal, briefcase: Briefcase, laptop: Laptop, code: Code, handshake: Handshake,
  car: Car, carfront: CarFront, bike: Bike, bus: Bus, train: TrainFront, plane: Plane, ship: Ship, fuel: Fuel, globe: Globe, map: Map, mountain: Mountain, palm: Palmtree, tent: Tent,
  home: Home, building: Building2, apartment: Building, hotel: Hotel, store: Store, sofa: Sofa, bed: Bed, armchair: Armchair, key: KeyRound, hammer: Hammer, wrench: Wrench,
  wallet: Wallet, piggy: PiggyBank, coins: Coins, banknote: Banknote, handcoins: HandCoins, landmark: Landmark, card: CreditCard, gem: Gem, gift: Gift, bag: ShoppingBag, shirt: Shirt, watch: Watch, scale: Scale,
  smartphone: Smartphone, headphones: Headphones, camera: Camera, tv: Tv, monitor: Monitor, gamepad: Gamepad2, music: Music2, piano: Piano, guitar: Guitar, mic: Mic, film: Film, palette: Palette,
  dumbbell: Dumbbell, activity: Activity, footprints: Footprints, stethoscope: Stethoscope, pill: Pill, apple: Apple, salad: Salad, coffee: Coffee, utensils: Utensils, pizza: Pizza,
  baby: Baby, users: Users, love: HeartHandshake, paw: PawPrint, cat: Cat, dog: Dog, sprout: Sprout, flower: Flower2, leaf: Leaf, tree: TreePine, droplets: Droplets, umbrella: Umbrella, snowflake: Snowflake, sun: Sun, moon: Moon, flame: Flame, zap: Zap, church: Church,
}

export const iconFor = (key: string | null | undefined, fallback: LucideIcon = Sparkles) => (key && ICONS[key]) || fallback

/** Pemilih ikon berbentuk grid + pencarian. Nilai dikirim lewat input hidden `name`. */
export function IconPicker({ name, defaultValue = "sparkles" }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue)
  const [q, setQ] = useState("")
  const term = q.trim().toLowerCase()
  return <div className="icon-picker">
    <input type="hidden" name={name} value={value}/>
    <div className="icon-search"><Search size={13}/><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari ikon: mobil, rumah, wisuda…" aria-label="Cari ikon"/></div>
    <div className="icon-groups">
      {ICON_GROUPS.map((g) => {
        const icons = g.icons.filter(([k, l]) => !term || l.toLowerCase().includes(term) || k.includes(term) || g.label.toLowerCase().includes(term))
        if (!icons.length) return null
        return <div key={g.label}><small>{g.label}</small><div className="icon-grid">{icons.map(([k, l]) => { const Icon = ICONS[k] ?? Sparkles
          return <button type="button" key={k} title={l} aria-label={l} aria-pressed={value === k} className={value === k ? "on" : ""} onClick={() => setValue(k)}><Icon size={17}/></button> })}</div></div>
      })}
    </div>
  </div>
}
