import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Flame,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CartItem } from '../../domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../domain/order/Order';
import {
  PRODUCT_CATEGORIES,
  Product,
  type ProductCategory,
} from '../../domain/product/Product';
import {
  isSupabaseConfigured,
  supabaseClient,
} from '../../infrastructure/supabase/supabaseClient';
import {
  formatOrderDateTime,
  getOrderDisplayNumber,
} from '../orderPresentation';
import { useApplicationLockStatus } from '../useApplicationLockStatus';
import { createCustomerDependencies } from './customerDependencies';

type CartLine = {
  product: Product;
  quantity: number;
};

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  note: string;
};

const {
  calculateOrderTotalUseCase,
  cancelCustomerOrderUseCase,
  createOrderUseCase,
  getCustomerOrderStatusUseCase,
  getApplicationLockStatusUseCase,
  getStoreSettingsUseCase,
  listActiveProductsUseCase,
} = createCustomerDependencies();

const ORDER_STATUS_POLL_INTERVAL_MS = 15000;
const STORE_SETTINGS_POLL_INTERVAL_MS = 60000;

// -------------------------------------------------------------------------
// Dados da loja — ajuste aqui conforme a operação real.
// (horário é um PLACEHOLDER; whatsapp/redes só aparecem se forem preenchidos)
// -------------------------------------------------------------------------
const STORE_INFO = {
  addressLine: 'R. Reinaldo Morano, nº 36',
  neighborhood: 'Jd. Maria Luiza I',
  hours: 'Ter. a Dom. · 18h às 23h',
  whatsappPhone: '', // ex.: '5544999999999'
  instagramUrl: '', // ex.: 'https://instagram.com/_brasitto'
  facebookUrl: '', // ex.: 'https://facebook.com/_brasitto'
};

const STORE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  'R. Reinaldo Morano 36, Jardim Maria Luiza',
)}`;

const HERO_IMAGE =
  'https://images.pexels.com/photos/23147806/pexels-photo-23147806.jpeg?auto=compress&cs=tinysrgb&w=1600';

const CATEGORY_TAGLINE: Record<ProductCategory, string> = {
  Espetos: 'Grelhados na brasa, no capricho.',
  Bebidas: 'Pra acompanhar e refrescar.',
  Doces: 'O final feliz da noite.',
};

const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const createCartItems = (cartLines: CartLine[]): CartItem[] =>
  cartLines.map((line) => ({
    product: line.product,
    quantity: line.quantity,
    unitPrice: line.product.price,
    totalPrice: line.product.price * line.quantity,
  }));

const groupProductsByCategory = (products: Product[]) =>
  PRODUCT_CATEGORIES.map((category) => ({
    category,
    products: products.filter((product) => product.category === category),
  }));

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const orderStatusLabel: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pendente',
  [OrderStatus.ACCEPTED]: 'Aceito',
  [OrderStatus.IN_PREPARATION]: 'Em preparo',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Saiu para entrega',
  [OrderStatus.READY_FOR_PICKUP]: 'Pronto para retirada',
  [OrderStatus.FINISHED]: 'Finalizado',
  [OrderStatus.CANCELED]: 'Cancelado',
};

const activeOrderStatuses = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
]);

const getErrorMessage = (error: unknown): string | null => {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return null;
};

export const getCustomerUserFacingErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  const errorMessage = getErrorMessage(error);

  if (!errorMessage) {
    return fallbackMessage;
  }

  if (errorMessage.includes('Failed to fetch')) {
    return 'Nao foi possivel conectar ao sistema de pedidos. Verifique sua conexao e tente novamente.';
  }

  if (
    errorMessage.includes('row-level security') ||
    errorMessage.includes('401') ||
    errorMessage.includes('403')
  ) {
    return 'O sistema recusou esta operacao. Tente novamente em alguns instantes.';
  }

  if (errorMessage.includes('customer name and phone')) {
    return 'Informe nome e telefone para enviar o pedido.';
  }

  if (errorMessage.includes('address')) {
    return 'Informe o endereco para pedido de entrega.';
  }

  if (errorMessage.includes('at least one item')) {
    return 'Adicione pelo menos um item ao pedido.';
  }

  if (errorMessage.includes('Order number')) {
    return 'Informe um numero de pedido valido.';
  }

  if (errorMessage.includes('Customer phone')) {
    return 'Informe o telefone usado no pedido.';
  }

  if (errorMessage.includes('Store is closed')) {
    return 'A loja esta fechada no momento.';
  }

  if (errorMessage.includes('Customer already has an active order')) {
    return 'Voce ja tem um pedido realizado com este telefone. Consulte ou cancele o pedido atual antes de fazer outro.';
  }

  if (errorMessage.includes('Customer order cannot be canceled')) {
    return 'Este pedido ja esta em preparo ou saiu para entrega. Entre em contato com a loja para cancelar.';
  }

  if (errorMessage.includes('Customer order not found')) {
    return 'Nao encontramos pedido com esse numero e telefone.';
  }

  return errorMessage;
};

// -------------------------------------------------------------------------
// Componentes de apresentação
// -------------------------------------------------------------------------

function StatusDot({ open }: { open: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {open ? (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-70" />
      ) : null}
      <span
        className={cn(
          'relative inline-flex h-2 w-2 rounded-full',
          open ? 'bg-sage' : 'bg-espresso-soft',
        )}
      />
    </span>
  );
}

function SiteHeader({
  solid,
  storeOpen,
}: {
  solid: boolean;
  storeOpen: boolean;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-colors duration-500',
        solid
          ? 'border-b border-line bg-cream/85 backdrop-blur-md'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid h-9 w-9 place-items-center rounded-full transition-colors',
              solid
                ? 'bg-terracotta-500 text-white shadow-soft'
                : 'bg-white/15 text-cream backdrop-blur',
            )}
          >
            <Flame className="h-5 w-5" />
          </span>
          <span
            className={cn(
              'font-display text-xl font-bold tracking-tight transition-colors',
              solid ? 'text-espresso-ink' : 'text-cream',
            )}
          >
            Brasitto
          </span>
        </a>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            solid
              ? storeOpen
                ? 'bg-sage/15 text-sage'
                : 'bg-brick/10 text-brick'
              : 'bg-white/12 text-cream backdrop-blur',
          )}
        >
          <StatusDot open={storeOpen} />
          {storeOpen ? 'Aberto' : 'Fechado'}
        </span>
      </div>
    </header>
  );
}

function Hero({ storeOpen }: { storeOpen: boolean }) {
  return (
    <section className="relative isolate -mt-16 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-espresso-ink/75 via-espresso-ink/45 to-espresso-ink/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-espresso-ink/85 via-espresso-ink/35 to-transparent" />
        <div className="absolute inset-0 animate-ember bg-[radial-gradient(65%_45%_at_50%_10%,rgba(201,138,40,0.28),transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-14 pt-36 sm:pb-20 sm:pt-44 lg:pb-24 lg:pt-48">
        <div className="max-w-2xl animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream backdrop-blur">
            <Flame className="h-3.5 w-3.5 text-honey" />
            Na brasa · Jd. Maria Luiza
          </span>

          <h1 className="mt-5 font-display text-[3.25rem] font-extrabold leading-[0.95] text-cream [text-shadow:0_2px_24px_rgba(20,12,6,0.4)] sm:text-7xl">
            Espeto na brasa,
            <span className="block italic text-honey">do nosso fogo.</span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-cream/80 sm:text-lg">
            Espetos artesanais grelhados na hora, bebidas geladas e sobremesas
            caseiras. Peça e receba, ou retire quentinho no local.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#cardapio"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-terracotta-500 py-1 pl-6 pr-2 text-sm font-semibold text-white shadow-lift transition-all duration-300 hover:bg-terracotta-600 active:scale-[0.98]"
            >
              Ver cardápio
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </a>
            <a
              href={STORE_MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 text-sm font-semibold text-cream backdrop-blur transition-colors duration-300 hover:bg-white/10"
            >
              <MapPin className="h-4 w-4 text-honey" />
              Como chegar
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cream/75">
            <span className="inline-flex items-center gap-2">
              <StatusDot open={storeOpen} />
              {storeOpen ? 'Aberto agora' : 'Fechado no momento'}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-honey" />
              {STORE_INFO.hours}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

type ProductCardProps = {
  product: Product;
  quantity: number;
  storeOpen: boolean;
  onAdd: (product: Product) => void;
  onDecrease: (product: Product) => void;
};

function ProductCard({
  product,
  quantity,
  storeOpen,
  onAdd,
  onDecrease,
}: ProductCardProps) {
  return (
    <article className="group flex gap-4 rounded-3xl border border-line bg-surface p-3 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card sm:p-4">
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl bg-sand sm:w-32">
        {product.imageUrl ? (
          <img
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            src={product.imageUrl}
          />
        ) : (
          <div className="grid h-full place-items-center text-espresso-soft">
            <Flame className="h-7 w-7" />
          </div>
        )}
        {quantity > 0 ? (
          <span className="absolute left-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-terracotta-500 px-1.5 text-xs font-bold text-white shadow-soft">
            {quantity}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-display text-lg font-bold leading-tight text-espresso-ink">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-snug text-espresso-muted">
          {product.description}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <span className="min-w-0 text-lg font-extrabold tracking-tight text-espresso-ink">
            {formatCurrency(product.price)}
          </span>

          {quantity === 0 ? (
            <button
              aria-label={`Adicionar ${product.name}`}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-terracotta-500 px-4 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-terracotta-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!storeOpen}
              type="button"
              onClick={() => onAdd(product)}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          ) : (
            <div className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-line bg-cream p-1">
              <button
                aria-label={`Diminuir ${product.name}`}
                className="grid h-8 w-8 place-items-center rounded-full text-espresso-body transition-colors hover:bg-sand active:scale-95"
                type="button"
                onClick={() => onDecrease(product)}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="grid w-6 place-items-center text-sm font-bold text-espresso-ink">
                {quantity}
              </span>
              <button
                aria-label={`Adicionar ${product.name}`}
                className="grid h-8 w-8 place-items-center rounded-full bg-terracotta-500 text-white transition-all hover:bg-terracotta-600 active:scale-95 disabled:opacity-40"
                disabled={!storeOpen}
                type="button"
                onClick={() => onAdd(product)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function SocialLinks() {
  const items = [
    STORE_INFO.instagramUrl && {
      href: STORE_INFO.instagramUrl,
      label: 'Instagram',
      path: 'M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.6-1.3-.8-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 100 9.8 4.9 4.9 0 000-9.8zm0 8.1a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zm5-8.3a1.15 1.15 0 11-2.3 0 1.15 1.15 0 012.3 0z',
    },
    STORE_INFO.facebookUrl && {
      href: STORE_INFO.facebookUrl,
      label: 'Facebook',
      path: 'M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0022 12z',
    },
    STORE_INFO.whatsappPhone && {
      href: `https://wa.me/${STORE_INFO.whatsappPhone}`,
      label: 'WhatsApp',
      path: 'M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.6.1-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.4-1.4-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.4.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.6-1.5-.9-2.1-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 .9-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 5 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 00-8.6 15L2 22l5.1-1.3A10 10 0 1012 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.3 8.3 0 1112 20.3z',
    },
  ].filter(Boolean) as Array<{ href: string; label: string; path: string }>;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 flex items-center gap-3">
      {items.map((item) => (
        <a
          key={item.label}
          aria-label={item.label}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-cream/80 transition-colors hover:bg-terracotta-500 hover:text-white"
          href={item.href}
          rel="noreferrer"
          target="_blank"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d={item.path} />
          </svg>
        </a>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 bg-[#1c140d] text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-terracotta-500">
              <Flame className="h-5 w-5" />
            </span>
            <span className="font-display text-2xl font-bold">Brasitto</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/60">
            Espetos na brasa, bebidas geladas e sobremesas caseiras. Feito na
            hora, do nosso fogo pra sua mesa.
          </p>
          <SocialLinks />
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-honey">
            Onde estamos
          </h3>
          <a
            className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-cream/80 transition-colors hover:text-cream"
            href={STORE_MAPS_URL}
            rel="noreferrer"
            target="_blank"
          >
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-300" />
            <span>
              {STORE_INFO.addressLine}
              <br />
              {STORE_INFO.neighborhood}
            </span>
          </a>
          <p className="mt-4 flex items-center gap-3 text-sm text-cream/80">
            <Clock className="h-5 w-5 shrink-0 text-terracotta-300" />
            {STORE_INFO.hours}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-honey">
            Peça agora
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-cream/60">
            Monte seu pedido pelo cardápio e receba em casa ou retire no local.
          </p>
          <a
            href="#cardapio"
            className="group mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-terracotta-500 py-1 pl-5 pr-2 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600"
          >
            Ver cardápio
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </a>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-6 text-xs text-cream/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Brasitto.</span>
          <span>Feito com fogo e capricho.</span>
        </div>
      </div>
    </footer>
  );
}

// -------------------------------------------------------------------------
// App do cliente
// -------------------------------------------------------------------------

export function CustomerApp() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductCategory, setSelectedProductCategory] =
    useState<ProductCategory>('Espetos');
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.PICKUP);
  const [form, setForm] = useState<CustomerForm>({
    name: '',
    phone: '',
    address: '',
    note: '',
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productErrorMessage, setProductErrorMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [storeSettings, setStoreSettings] = useState({
    storeOpen: true,
    deliveryFee: 8,
  });
  const [isCheckingStoreSettings, setIsCheckingStoreSettings] = useState(true);
  const [statusOrderNumber, setStatusOrderNumber] = useState('');
  const [statusCustomerPhone, setStatusCustomerPhone] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isLoadingOrderStatus, setIsLoadingOrderStatus] = useState(false);
  const [isCancelingOrder, setIsCancelingOrder] = useState(false);
  const [isOrderLookupOpen, setIsOrderLookupOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);
  const [orderStatusMessage, setOrderStatusMessage] = useState('');
  const [orderStatusMessageTone, setOrderStatusMessageTone] = useState<
    'error' | 'success'
  >('error');
  const heroSentinelRef = useRef<HTMLDivElement | null>(null);
  const { isCheckingApplicationLock, isApplicationLocked } =
    useApplicationLockStatus(
      'customer-application-lock',
      getApplicationLockStatusUseCase,
    );

  useEffect(() => {
    if (isCheckingApplicationLock || isApplicationLocked) {
      setIsLoadingProducts(false);
      return;
    }

    let isMounted = true;

    async function loadProducts() {
      setIsLoadingProducts(true);
      setProductErrorMessage('');

      try {
        const activeProducts = await listActiveProductsUseCase.execute();

        if (isMounted) {
          setProducts(activeProducts);
        }
      } catch (error) {
        if (isMounted) {
          setProductErrorMessage(
            getCustomerUserFacingErrorMessage(
              error,
              'Nao foi possivel carregar o cardapio.',
            ),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [isApplicationLocked, isCheckingApplicationLock]);

  useEffect(() => {
    let isMounted = true;

    async function refreshIfMounted(options: { showLoading?: boolean } = {}) {
      if (!isMounted) {
        return;
      }

      if (options.showLoading) {
        setIsCheckingStoreSettings(true);
      }

      try {
        const settings = await getStoreSettingsUseCase.execute();

        if (!isMounted) {
          return;
        }

        setStoreSettings(settings);

        if (!settings.storeOpen) {
          setCreatedOrder(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingStoreSettings(false);
        }
      }
    }

    void refreshIfMounted({ showLoading: true });

    const intervalId = window.setInterval(() => {
      void refreshIfMounted();
    }, STORE_SETTINGS_POLL_INTERVAL_MS);

    if (!isSupabaseConfigured || supabaseClient === null) {
      return () => {
        isMounted = false;
        window.clearInterval(intervalId);
      };
    }

    const realtimeClient = supabaseClient;
    const channel = realtimeClient
      .channel('customer-store-settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.store_settings',
        },
        () => {
          void refreshIfMounted();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refreshIfMounted();
        }
      });

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      void realtimeClient.removeChannel(channel);
    };
  }, []);

  // Header muda para sólido depois que o hero sai da viewport.
  useEffect(() => {
    const sentinel = heroSentinelRef.current;

    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setHeaderSolid(!entry.isIntersecting),
      { rootMargin: '-72px 0px 0px 0px', threshold: 0 },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [isCheckingApplicationLock, isCheckingStoreSettings, isApplicationLocked]);

  // Trava o scroll do fundo enquanto o drawer do pedido está aberto (mobile).
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    if (isCartOpen && !isDesktop) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [isCartOpen]);

  const cartItems = useMemo(() => createCartItems(cartLines), [cartLines]);

  const totals = useMemo(() => {
    if (cartItems.length === 0) {
      return {
        subtotal: 0,
        deliveryFee: 0,
        total: 0,
      };
    }

    if (orderType === OrderType.DELIVERY && form.address.trim() === '') {
      return {
        subtotal: cartItems.reduce((total, item) => total + item.totalPrice, 0),
        deliveryFee: storeSettings.deliveryFee,
        total:
          cartItems.reduce((total, item) => total + item.totalPrice, 0) +
          storeSettings.deliveryFee,
      };
    }

    return calculateOrderTotalUseCase.execute({
      type: orderType,
      address:
        orderType === OrderType.DELIVERY ? form.address.trim() : undefined,
      items: cartItems,
      deliveryFee: storeSettings.deliveryFee,
    });
  }, [cartItems, form.address, orderType, storeSettings.deliveryFee]);

  const totalItems = useMemo(
    () => cartLines.reduce((total, line) => total + line.quantity, 0),
    [cartLines],
  );
  const productsByCategory = useMemo(
    () => groupProductsByCategory(products),
    [products],
  );
  const selectedCategoryProducts = useMemo(
    () =>
      productsByCategory.find(
        ({ category }) => category === selectedProductCategory,
      )?.products ?? [],
    [productsByCategory, selectedProductCategory],
  );
  const canCancelTrackedOrder =
    trackedOrder?.status === OrderStatus.PENDING ||
    trackedOrder?.status === OrderStatus.ACCEPTED;

  function addProduct(product: Product) {
    if (!product.active) {
      return;
    }

    if (!storeSettings.storeOpen) {
      return;
    }

    setCreatedOrder(null);
    setCartLines((currentLines) => {
      const existingLine = currentLines.find(
        (line) => line.product.id === product.id,
      );

      if (!existingLine) {
        return [...currentLines, { product, quantity: 1 }];
      }

      return currentLines.map((line) =>
        line.product.id === product.id
          ? { ...line, quantity: line.quantity + 1 }
          : line,
      );
    });
  }

  function decreaseProduct(product: Product) {
    setCreatedOrder(null);
    setCartLines((currentLines) =>
      currentLines.flatMap((line) => {
        if (line.product.id !== product.id) {
          return [line];
        }

        if (line.quantity === 1) {
          return [];
        }

        return [{ ...line, quantity: line.quantity - 1 }];
      }),
    );
  }

  function removeProduct(product: Product) {
    setCreatedOrder(null);
    setCartLines((currentLines) =>
      currentLines.filter((line) => line.product.id !== product.id),
    );
  }

  function updateForm(field: keyof CustomerForm, value: string) {
    setCreatedOrder(null);
    setErrorMessage('');
    setForm((currentForm) => ({
      ...currentForm,
      [field]: field === 'phone' ? formatPhone(value) : value,
    }));
  }

  const loadCustomerOrderStatus = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const orderNumber = Number(statusOrderNumber);

      if (!options.silent) {
        setIsLoadingOrderStatus(true);
        setOrderStatusMessage('');
        setOrderStatusMessageTone('error');
      }

      try {
        const order = await getCustomerOrderStatusUseCase.execute({
          orderNumber,
          customerPhone: statusCustomerPhone.trim(),
        });

        setTrackedOrder(order);

        if (!order) {
          setOrderStatusMessageTone('error');
          setOrderStatusMessage(
            'Nao encontramos pedido com esse numero e telefone.',
          );
        }
      } catch (error) {
        if (!options.silent) {
          setTrackedOrder(null);
          setOrderStatusMessageTone('error');
          setOrderStatusMessage(
            getCustomerUserFacingErrorMessage(
              error,
              'Nao foi possivel consultar o pedido.',
            ),
          );
        }
      } finally {
        if (!options.silent) {
          setIsLoadingOrderStatus(false);
        }
      }
    },
    [statusCustomerPhone, statusOrderNumber],
  );

  useEffect(() => {
    if (!trackedOrder || !activeOrderStatuses.has(trackedOrder.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadCustomerOrderStatus({ silent: true });
    }, ORDER_STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadCustomerOrderStatus, trackedOrder]);

  async function submitOrderStatusLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCustomerOrderStatus();
  }

  async function cancelTrackedOrder() {
    const orderNumber = Number(statusOrderNumber);

    if (!canCancelTrackedOrder || isCancelingOrder) {
      return;
    }

    if (!window.confirm('Cancelar este pedido?')) {
      return;
    }

    setIsCancelingOrder(true);
    setOrderStatusMessage('');
    setOrderStatusMessageTone('error');

    try {
      const canceledOrder = await cancelCustomerOrderUseCase.execute({
        orderNumber,
        customerPhone: statusCustomerPhone.trim(),
      });

      setTrackedOrder(canceledOrder);
      setOrderStatusMessageTone('success');
      setOrderStatusMessage('Pedido cancelado com sucesso.');
    } catch (error) {
      setOrderStatusMessageTone('error');
      setOrderStatusMessage(
        getCustomerUserFacingErrorMessage(
          error,
          'Nao foi possivel cancelar o pedido.',
        ),
      );
    } finally {
      setIsCancelingOrder(false);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingOrder) {
      return;
    }

    setErrorMessage('');
    setCreatedOrder(null);
    setIsSubmittingOrder(true);

    try {
      if (!storeSettings.storeOpen) {
        throw new Error('Store is closed');
      }

      const order = await createOrderUseCase.execute({
        id: crypto.randomUUID(),
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        type: orderType,
        address:
          orderType === OrderType.DELIVERY ? form.address.trim() : undefined,
        customerNote: form.note.trim() || undefined,
        items: cartItems,
        deliveryFee: storeSettings.deliveryFee,
        createdAt: new Date(),
      });

      setCreatedOrder(order);
      setStatusOrderNumber(order.orderNumber?.toString() ?? '');
      setStatusCustomerPhone(form.phone);
      setTrackedOrder(order);
      setOrderStatusMessage('');
      setCartLines([]);
      setForm({
        name: '',
        phone: '',
        address: '',
        note: '',
      });
      setOrderType(OrderType.PICKUP);
    } catch (error) {
      if (
        getErrorMessage(error)?.includes('Customer already has an active order')
      ) {
        setStatusCustomerPhone(form.phone);
        setIsOrderLookupOpen(true);
        setIsCartOpen(true);
      }

      setErrorMessage(
        getCustomerUserFacingErrorMessage(
          error,
          'Nao foi possivel enviar o pedido.',
        ),
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  function startNewOrder() {
    setCreatedOrder(null);
    setErrorMessage('');
  }

  if (isCheckingApplicationLock || isCheckingStoreSettings) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-cream px-5">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid h-14 w-14 animate-ember place-items-center rounded-full bg-terracotta-500 text-white shadow-lift">
            <Flame className="h-7 w-7" />
          </span>
          <p className="text-sm font-medium text-espresso-muted">
            Acendendo a brasa...
          </p>
        </div>
      </main>
    );
  }

  if (isApplicationLocked) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-cream px-5">
        <div className="max-w-md rounded-4xl border border-line bg-surface p-8 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brick/10 text-brick">
            <Flame className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold text-espresso-ink">
            Estamos fora do ar
          </h1>
          <p className="mt-2 text-sm leading-6 text-espresso-muted">
            A loja está temporariamente indisponível. Entre em contato com o
            administrador.
          </p>
        </div>
      </main>
    );
  }

  const hasMenu =
    !isLoadingProducts && !productErrorMessage && products.length > 0;

  const orderPanel = (
    <div className="flex flex-1 flex-col overflow-hidden lg:block lg:overflow-visible">
      {/* Cabeçalho do drawer (mobile) */}
      <div className="lg:hidden">
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-2">
          <h2 className="font-display text-xl font-bold text-espresso-ink">
            Seu pedido
          </h2>
          <button
            aria-label="Fechar pedido"
            className="grid h-9 w-9 place-items-center rounded-full bg-cream text-espresso-muted transition-colors hover:bg-sand"
            type="button"
            onClick={() => setIsCartOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 lg:max-h-[calc(100dvh-8rem)] lg:px-6 lg:py-6">
        {/* Cabeçalho (desktop) */}
        <div className="mb-5 hidden items-center justify-between lg:flex">
          <h2 className="font-display text-2xl font-bold text-espresso-ink">
            Seu pedido
          </h2>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-terracotta-50 text-terracotta-500">
            <ShoppingBag className="h-5 w-5" />
          </span>
        </div>

        {/* Consultar pedido */}
        <section className="mb-5">
          <button
            aria-expanded={isOrderLookupOpen}
            className="flex w-full items-center justify-between gap-2 rounded-2xl border border-line bg-cream px-4 py-3 text-sm font-semibold text-espresso-body transition-colors hover:border-terracotta-200"
            type="button"
            onClick={() => setIsOrderLookupOpen((current) => !current)}
          >
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-terracotta-500" />
              Consultar um pedido
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-espresso-muted transition-transform',
                isOrderLookupOpen && 'rotate-180',
              )}
            />
          </button>

          {isOrderLookupOpen ? (
            <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
              <form className="grid gap-3" onSubmit={submitOrderStatusLookup}>
                <label className="grid gap-1.5 text-sm font-medium text-espresso-body">
                  Número do pedido
                  <input
                    className="h-11 rounded-xl border border-line bg-cream px-3 text-sm text-espresso-ink outline-none transition-colors focus:border-terracotta-500"
                    inputMode="numeric"
                    min="1"
                    type="number"
                    value={statusOrderNumber}
                    onChange={(event) => {
                      setStatusOrderNumber(event.target.value);
                      setOrderStatusMessage('');
                      setOrderStatusMessageTone('error');
                    }}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-espresso-body">
                  Telefone
                  <input
                    className="h-11 rounded-xl border border-line bg-cream px-3 text-sm text-espresso-ink outline-none transition-colors focus:border-terracotta-500"
                    value={statusCustomerPhone}
                    onChange={(event) => {
                      setStatusCustomerPhone(formatPhone(event.target.value));
                      setOrderStatusMessage('');
                      setOrderStatusMessageTone('error');
                    }}
                  />
                </label>
                <button
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-espresso-ink text-sm font-semibold text-cream transition-colors hover:bg-espresso-body disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoadingOrderStatus}
                  type="submit"
                >
                  <Search className="h-4 w-4" />
                  {isLoadingOrderStatus ? 'Consultando...' : 'Consultar'}
                </button>
              </form>

              {orderStatusMessage ? (
                <p
                  className={cn(
                    'mt-3 rounded-xl border p-3 text-sm',
                    orderStatusMessageTone === 'success'
                      ? 'border-sage/30 bg-sage/10 text-sage'
                      : 'border-brick/25 bg-brick/5 text-brick',
                  )}
                >
                  {orderStatusMessage}
                </p>
              ) : null}

              {trackedOrder ? (
                <div className="mt-3 rounded-2xl border border-line bg-cream p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-espresso-ink">
                      {getOrderDisplayNumber(trackedOrder)}
                    </p>
                    <span className="rounded-full bg-honey/15 px-2.5 py-1 text-xs font-semibold text-espresso-body">
                      {orderStatusLabel[trackedOrder.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-espresso-muted">
                    Recebido em {formatOrderDateTime(trackedOrder.createdAt)}
                  </p>
                  <p className="mt-1 text-espresso-muted">
                    {trackedOrder.type === OrderType.DELIVERY
                      ? 'Entrega'
                      : 'Retirada'}
                  </p>
                  {trackedOrder.estimatedReadyAt ? (
                    <p className="mt-2 rounded-xl border border-sage/30 bg-sage/10 p-3 text-sage">
                      Previsão:{' '}
                      {formatOrderDateTime(trackedOrder.estimatedReadyAt)}
                    </p>
                  ) : null}
                  {trackedOrder.status === OrderStatus.CANCELED &&
                    trackedOrder.cancellationReason ? (
                    <p className="mt-3 rounded-xl border border-brick/25 bg-brick/5 p-3 text-brick">
                      Motivo do cancelamento: {trackedOrder.cancellationReason}
                    </p>
                  ) : null}
                  {canCancelTrackedOrder ? (
                    <button
                      className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brick/30 bg-brick/5 text-sm font-semibold text-brick transition-colors hover:bg-brick/10 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isCancelingOrder}
                      type="button"
                      onClick={cancelTrackedOrder}
                    >
                      <XCircle className="h-4 w-4" />
                      {isCancelingOrder ? 'Cancelando...' : 'Cancelar pedido'}
                    </button>
                  ) : null}
                  <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                    {trackedOrder.items.map((item) => (
                      <div
                        key={`${trackedOrder.id}-${item.product.name}`}
                        className="grid grid-cols-[1fr_auto] gap-3 py-2"
                      >
                        <span className="text-espresso-body">
                          {item.quantity} × {item.product.name}
                        </span>
                        <strong className="font-semibold text-espresso-ink">
                          {formatCurrency(item.totalPrice)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                    <span className="font-semibold text-espresso-ink">
                      Total
                    </span>
                    <strong className="font-bold text-espresso-ink">
                      {formatCurrency(trackedOrder.total)}
                    </strong>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Confirmação de pedido enviado */}
        {createdOrder ? (
          <div className="mb-5 animate-fade-up rounded-3xl border border-sage/30 bg-sage/5 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sage text-white">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-bold text-espresso-ink">
                  Pedido enviado!
                </p>
                <p className="mt-0.5 text-sm text-espresso-muted">
                  {getOrderDisplayNumber(createdOrder)} · recebido em{' '}
                  {formatOrderDateTime(createdOrder.createdAt)}.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-espresso-ink">
                {createdOrder.type === OrderType.DELIVERY ? (
                  <Truck className="h-4 w-4 text-terracotta-500" />
                ) : (
                  <PackageCheck className="h-4 w-4 text-sage" />
                )}
                {createdOrder.type === OrderType.DELIVERY
                  ? 'Entrega'
                  : 'Retirada'}
              </div>

              <div className="mt-3 grid gap-1 text-sm text-espresso-body">
                <p>
                  <span className="font-medium text-espresso-ink">Cliente:</span>{' '}
                  {createdOrder.customerName}
                </p>
                <p>
                  <span className="font-medium text-espresso-ink">
                    Telefone:
                  </span>{' '}
                  {createdOrder.customerPhone}
                </p>
                {createdOrder.customerNote ? (
                  <p>
                    <span className="font-medium text-espresso-ink">
                      Observação:
                    </span>{' '}
                    {createdOrder.customerNote}
                  </p>
                ) : null}
                {createdOrder.type === OrderType.DELIVERY ? (
                  <p>
                    <span className="font-medium text-espresso-ink">
                      Endereço:
                    </span>{' '}
                    {createdOrder.address}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 divide-y divide-line border-t border-line pt-1">
                {createdOrder.items.map((item) => (
                  <div
                    key={`${createdOrder.id}-${item.product.name}`}
                    className="grid grid-cols-[1fr_auto] gap-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-espresso-ink">
                        {item.product.name}
                      </p>
                      <p className="mt-0.5 text-espresso-muted">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <strong className="font-semibold text-espresso-ink">
                      {formatCurrency(item.totalPrice)}
                    </strong>
                  </div>
                ))}
              </div>

              <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-espresso-muted">Subtotal</dt>
                  <dd className="font-semibold text-espresso-ink">
                    {formatCurrency(createdOrder.subtotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-espresso-muted">Taxa de entrega</dt>
                  <dd className="font-semibold text-espresso-ink">
                    {formatCurrency(createdOrder.deliveryFee)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-2 text-base">
                  <dt className="font-bold text-espresso-ink">Total</dt>
                  <dd className="font-bold text-espresso-ink">
                    {formatCurrency(createdOrder.total)}
                  </dd>
                </div>
              </dl>
            </div>

            <button
              className="mt-4 h-11 w-full rounded-xl bg-sage text-sm font-semibold text-white transition-colors hover:brightness-95"
              type="button"
              onClick={startNewOrder}
            >
              Fazer novo pedido
            </button>
          </div>
        ) : null}

        {/* Carrinho vazio */}
        {cartLines.length === 0 ? (
          createdOrder ? null : (
            <div className="rounded-3xl border border-dashed border-line bg-cream/60 px-5 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-terracotta-50 text-terracotta-400">
                <Flame className="h-7 w-7" />
              </span>
              <p className="mt-4 font-display text-lg font-bold text-espresso-ink">
                {storeSettings.storeOpen
                  ? 'Seu carrinho está vazio'
                  : 'Loja fechada'}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-espresso-muted">
                {storeSettings.storeOpen
                  ? 'Escolha seus espetos, bebidas e sobremesas no cardápio.'
                  : 'Pedidos indisponíveis enquanto a loja estiver fechada.'}
              </p>
              {storeSettings.storeOpen ? (
                <a
                  href="#cardapio"
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-terracotta-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 lg:hidden"
                  onClick={() => setIsCartOpen(false)}
                >
                  Ver cardápio
                </a>
              ) : null}
            </div>
          )
        ) : (
          <form className="space-y-5" onSubmit={submitOrder}>
            {/* Itens */}
            <div className="space-y-3">
              {cartLines.map((line) => (
                <div
                  key={line.product.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-cream/60 p-3"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-sand">
                    {line.product.imageUrl ? (
                      <img
                        alt=""
                        aria-hidden
                        className="h-full w-full object-cover"
                        loading="lazy"
                        src={line.product.imageUrl}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-espresso-soft">
                        <Flame className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-espresso-ink">
                      {line.product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-espresso-muted">
                      {line.quantity} × {formatCurrency(line.product.price)}
                    </p>
                  </div>
                  <strong className="text-sm font-bold text-espresso-ink">
                    {formatCurrency(line.product.price * line.quantity)}
                  </strong>
                  <button
                    aria-label={`Remover ${line.product.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-espresso-muted transition-colors hover:bg-brick/10 hover:text-brick"
                    type="button"
                    onClick={() => removeProduct(line.product)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Tipo de pedido */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-cream p-1">
              <button
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all',
                  orderType === OrderType.PICKUP
                    ? 'bg-surface text-terracotta-600 shadow-soft'
                    : 'text-espresso-muted hover:text-espresso-body',
                )}
                type="button"
                onClick={() => setOrderType(OrderType.PICKUP)}
              >
                <PackageCheck className="h-4 w-4" />
                Retirada
              </button>
              <button
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all',
                  orderType === OrderType.DELIVERY
                    ? 'bg-surface text-terracotta-600 shadow-soft'
                    : 'text-espresso-muted hover:text-espresso-body',
                )}
                type="button"
                onClick={() => setOrderType(OrderType.DELIVERY)}
              >
                <Truck className="h-4 w-4" />
                Entrega
              </button>
            </div>

            {orderType === OrderType.PICKUP ? (
              <a
                href={STORE_MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 rounded-2xl border border-line bg-cream/60 p-3 text-sm text-espresso-body transition-colors hover:border-terracotta-200"
              >
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-500" />
                <span>
                  <span className="font-semibold text-espresso-ink">
                    Retire no local
                  </span>
                  <br />
                  {STORE_INFO.addressLine} — {STORE_INFO.neighborhood}
                </span>
              </a>
            ) : null}

            {/* Dados do cliente */}
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium text-espresso-body">
                Nome
                <input
                  className="h-11 rounded-xl border border-line bg-cream px-3 text-sm text-espresso-ink outline-none transition-colors focus:border-terracotta-500"
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-espresso-body">
                Telefone
                <input
                  className="h-11 rounded-xl border border-line bg-cream px-3 text-sm text-espresso-ink outline-none transition-colors focus:border-terracotta-500"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                />
              </label>
              {orderType === OrderType.DELIVERY ? (
                <label className="grid gap-1.5 text-sm font-medium text-espresso-body">
                  Endereço
                  <input
                    className="h-11 rounded-xl border border-line bg-cream px-3 text-sm text-espresso-ink outline-none transition-colors focus:border-terracotta-500"
                    value={form.address}
                    onChange={(event) =>
                      updateForm('address', event.target.value)
                    }
                  />
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm font-medium text-espresso-body">
                Observações
                <textarea
                  className="min-h-20 rounded-xl border border-line bg-cream px-3 py-2 text-sm text-espresso-ink outline-none transition-colors focus:border-terracotta-500"
                  placeholder="Ex.: ponto da carne, sem cebola, troco para R$ 50..."
                  value={form.note}
                  onChange={(event) => updateForm('note', event.target.value)}
                />
              </label>
            </div>

            {/* Totais + envio (fixo no rodapé do painel) */}
            <div className="sticky bottom-0 -mx-5 mt-2 border-t border-line bg-surface/95 px-5 pb-4 pt-4 backdrop-blur lg:-mx-6 lg:px-6">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-espresso-muted">Subtotal</span>
                  <strong className="font-semibold text-espresso-ink">
                    {formatCurrency(totals.subtotal)}
                  </strong>
                </div>
                {orderType === OrderType.DELIVERY ? (
                  <div className="flex items-center justify-between">
                    <span className="text-espresso-muted">Taxa de entrega</span>
                    <strong className="font-semibold text-espresso-ink">
                      {formatCurrency(totals.deliveryFee)}
                    </strong>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-line pt-2 text-base">
                  <span className="font-bold text-espresso-ink">Total</span>
                  <strong className="font-bold text-espresso-ink">
                    {formatCurrency(totals.total)}
                  </strong>
                </div>
              </div>

              {errorMessage ? (
                <p className="mt-3 rounded-xl border border-brick/25 bg-brick/5 p-3 text-sm text-brick">
                  {errorMessage}
                </p>
              ) : null}

              {!storeSettings.storeOpen ? (
                <p className="mt-3 rounded-xl border border-honey/30 bg-honey/10 p-3 text-sm text-espresso-body">
                  A loja fechou para novos pedidos.
                </p>
              ) : null}

              <button
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-terracotta-500 text-sm font-bold text-white shadow-soft transition-all hover:bg-terracotta-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!storeSettings.storeOpen || isSubmittingOrder}
                type="submit"
              >
                {isSubmittingOrder
                  ? 'Enviando...'
                  : storeSettings.storeOpen
                    ? 'Enviar pedido'
                    : 'Loja fechada'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <div id="top" className="relative min-h-[100dvh] bg-cream">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] grain-overlay"
      />

      <SiteHeader solid={headerSolid} storeOpen={storeSettings.storeOpen} />
      <Hero storeOpen={storeSettings.storeOpen} />
      <div ref={heroSentinelRef} aria-hidden className="h-px w-full" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-5">
        <div className="lg:grid lg:grid-cols-[1fr_390px] lg:gap-8 lg:pt-10">
          {/* CARDÁPIO */}
          <section
            id="cardapio"
            aria-labelledby="menu-title"
            className="scroll-mt-20 pb-28 pt-10 lg:pb-16 lg:pt-0"
          >
            {!storeSettings.storeOpen ? (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-honey/30 bg-honey/10 p-4 text-sm text-espresso-body">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-honey" />
                <div>
                  <p className="font-semibold text-espresso-ink">
                    Loja fechada no momento
                  </p>
                  <p className="mt-0.5">
                    Você ainda pode consultar um pedido já enviado.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="animate-fade-up">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-500">
                Cardápio
              </span>
              <h2
                id="menu-title"
                className="mt-2 font-display text-3xl font-extrabold tracking-tight text-espresso-ink sm:text-4xl"
              >
                Escolha e monte seu pedido
              </h2>
              <p className="mt-2 max-w-md text-sm text-espresso-muted">
                Tudo preparado na hora, na brasa. Adicione ao carrinho e finalize
                em segundos.
              </p>
            </div>

            {isLoadingProducts ? (
              <div className="mt-6 grid gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="flex gap-4 rounded-3xl border border-line bg-surface p-4"
                  >
                    <div className="h-24 w-24 shrink-0 animate-pulse rounded-2xl bg-sand sm:h-32 sm:w-32" />
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-4 w-1/2 animate-pulse rounded bg-sand" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-sand" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-sand" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {productErrorMessage ? (
              <div className="mt-6 rounded-2xl border border-brick/25 bg-brick/5 p-4 text-sm text-brick">
                {productErrorMessage}
              </div>
            ) : null}

            {!isLoadingProducts &&
              !productErrorMessage &&
              products.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm text-espresso-muted">
                Nenhum produto ativo disponível.
              </div>
            ) : null}

            {hasMenu ? (
              <>
                {/* Categorias (fixas no topo ao rolar) */}
                <div
                  aria-label="Categorias do cardápio"
                  className="no-scrollbar sticky top-16 z-20 -mx-4 mt-6 flex gap-2 overflow-x-auto border-b border-line/70 bg-cream/90 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5"
                  role="tablist"
                >
                  {productsByCategory.map(({ category, products: items }) => {
                    const isSelected = selectedProductCategory === category;

                    return (
                      <button
                        key={category}
                        aria-controls={`category-panel-${category}`}
                        aria-selected={isSelected}
                        className={cn(
                          'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all',
                          isSelected
                            ? 'border-terracotta-500 bg-terracotta-500 text-white shadow-soft'
                            : 'border-line bg-surface text-espresso-body hover:border-terracotta-200',
                        )}
                        id={`category-tab-${category}`}
                        role="tab"
                        type="button"
                        onClick={() => setSelectedProductCategory(category)}
                      >
                        {category}
                        <span
                          className={cn(
                            'grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-bold',
                            isSelected
                              ? 'bg-white/25 text-white'
                              : 'bg-cream text-espresso-muted',
                          )}
                        >
                          {items.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-baseline gap-2">
                  <h3 className="font-display text-xl font-bold text-espresso-ink">
                    {selectedProductCategory}
                  </h3>
                  <span className="text-sm text-espresso-muted">
                    {CATEGORY_TAGLINE[selectedProductCategory]}
                  </span>
                </div>

                <section
                  aria-labelledby={`category-tab-${selectedProductCategory}`}
                  className="mt-4 grid gap-3 sm:grid-cols-2"
                  id={`category-panel-${selectedProductCategory}`}
                  role="tabpanel"
                >
                  {selectedCategoryProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-line bg-cream/60 p-4 text-sm text-espresso-muted sm:col-span-2">
                      Nenhum item ativo nesta categoria.
                    </div>
                  ) : null}

                  {selectedCategoryProducts.map((product) => {
                    const quantity =
                      cartLines.find((line) => line.product.id === product.id)
                        ?.quantity ?? 0;

                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        quantity={quantity}
                        storeOpen={storeSettings.storeOpen}
                        onAdd={addProduct}
                        onDecrease={decreaseProduct}
                      />
                    );
                  })}
                </section>
              </>
            ) : null}
          </section>

          {/* PAINEL DO PEDIDO — aside no desktop, drawer no mobile */}
          <div
            aria-hidden={!isCartOpen}
            className={cn(
              'fixed inset-0 z-40 bg-espresso-ink/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
              isCartOpen
                ? 'opacity-100'
                : 'pointer-events-none opacity-0',
            )}
            onClick={() => setIsCartOpen(false)}
          />

          <aside
            aria-label="Seu pedido"
            className={cn(
              'z-50 flex flex-col lg:z-auto',
              'fixed inset-x-0 bottom-0 max-h-[90dvh] rounded-t-4xl border-t border-line bg-surface shadow-lift transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
              isCartOpen
                ? 'translate-y-0'
                : 'pointer-events-none translate-y-[105%] lg:pointer-events-auto',
              'lg:sticky lg:bottom-auto lg:top-24 lg:max-h-none lg:translate-y-0 lg:self-start lg:rounded-3xl lg:border lg:shadow-card lg:transition-none',
            )}
          >
            {orderPanel}
          </aside>
        </div>
      </div>

      <Footer />

      {/* Barra flutuante de pedido (mobile) */}
      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        className={cn(
          'fixed inset-x-4 bottom-4 z-30 flex items-center justify-between gap-3 rounded-full px-5 py-3.5 shadow-lift transition-all duration-300 lg:hidden',
          isCartOpen && 'pointer-events-none translate-y-6 opacity-0',
          totalItems > 0
            ? 'bg-terracotta-500 text-white'
            : 'border border-line bg-surface text-espresso-ink',
        )}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              'relative grid h-9 w-9 place-items-center rounded-full',
              totalItems > 0 ? 'bg-white/15' : 'bg-terracotta-50',
            )}
          >
            <ShoppingBag
              className={cn(
                'h-5 w-5',
                totalItems > 0 ? 'text-white' : 'text-terracotta-500',
              )}
            />
          </span>
          <span className="text-left">
            <span className="block text-sm font-bold leading-tight">
              {createdOrder
                ? 'Pedido enviado'
                : totalItems > 0
                  ? `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`
                  : 'Seu pedido'}
            </span>
            <span
              className={cn(
                'block text-xs leading-tight',
                totalItems > 0 ? 'text-white/80' : 'text-espresso-muted',
              )}
            >
              {totalItems > 0 ? 'Toque para finalizar' : 'Ver ou consultar'}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {totalItems > 0 ? (
            <strong className="text-base font-extrabold">
              {formatCurrency(totals.total)}
            </strong>
          ) : null}
          <ChevronRight className="h-5 w-5 opacity-80" />
        </span>
      </button>
    </div>
  );
}
