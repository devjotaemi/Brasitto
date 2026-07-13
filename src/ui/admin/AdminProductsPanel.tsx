import { Edit3, PackagePlus, RefreshCw, Save } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from '../../domain/product/Product';
import {
  isSupabaseConfigured,
  supabaseClient,
} from '../../infrastructure/supabase/supabaseClient';
import { createCustomerDependencies } from '../customer/customerDependencies';

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: ProductCategory;
  imageUrl: string;
  active: boolean;
};

const emptyForm: ProductForm = {
  name: '',
  description: '',
  price: '',
  category: 'Espetos',
  imageUrl: '',
  active: true,
};

const { listProductsUseCase, saveProductUseCase } = createCustomerDependencies();
const PRODUCT_IMAGE_BUCKET = 'product-images';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const toForm = (product: Product): ProductForm => ({
  id: product.id,
  name: product.name,
  description: product.description,
  price: String(product.price),
  category: product.category,
  imageUrl: product.imageUrl ?? '',
  active: product.active,
});

const parseProductPrice = (value: string): number =>
  Number(value.replace(',', '.'));

const getImageExtension = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (!extension || extension === fileName.toLowerCase()) {
    return 'jpg';
  }

  return extension;
};

const getUserFacingErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (
    error.message.includes('permission') ||
    error.message.includes('row-level security') ||
    error.message.includes('401') ||
    error.message.includes('403')
  ) {
    return 'Seu acesso administrativo expirou ou nao tem permissao para esta acao. Saia e entre novamente.';
  }

  if (error.message.includes('Failed to fetch')) {
    return 'Nao foi possivel conectar ao Supabase. Verifique sua conexao e tente novamente.';
  }

  if (error.message.includes('Image upload requires Supabase')) {
    return 'Upload de foto exige Supabase configurado.';
  }

  if (error.message.includes('Product image must be an image file')) {
    return 'Selecione um arquivo de imagem valido.';
  }

  if (error.message.includes('Product image is too large')) {
    return 'A foto deve ter no maximo 5 MB.';
  }

  if (error.message.includes('Bucket not found')) {
    return 'Bucket de fotos nao encontrado. Rode o SQL de configuracao do Storage no Supabase.';
  }

  if (error.message.includes('greater than zero')) {
    return 'Informe um preco maior que zero.';
  }

  if (error.message.includes('valid number')) {
    return 'Informe um preco valido.';
  }

  if (error.message.includes('Product name is required')) {
    return 'Informe o nome do produto.';
  }

  if (error.message.includes('Product description is required')) {
    return 'Informe a descricao do produto.';
  }

  if (error.message.includes('Product category is invalid')) {
    return 'Selecione uma categoria valida.';
  }

  if (error.message.includes('Product image URL must start')) {
    return 'Informe uma URL de foto iniciando com http:// ou https://.';
  }

  if (error.message.includes('Product image URL is too long')) {
    return 'A URL da foto deve ter no maximo 1000 caracteres.';
  }

  return error.message;
};

export function AdminProductsPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageInputKey, setImageInputKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadProducts() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      setProducts(await listProductsUseCase.execute());
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel carregar os produtos.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function updateForm(field: keyof ProductForm, value: string | boolean) {
    setErrorMessage('');
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setSelectedImageFile(null);
    setImagePreviewUrl('');
    setImageInputKey((currentKey) => currentKey + 1);
  }

  function editProduct(product: Product) {
    setForm(toForm(product));
    setSelectedImageFile(null);
    setImagePreviewUrl('');
    setImageInputKey((currentKey) => currentKey + 1);
  }

  function updateImageFile(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage('');

    const file = event.target.files?.[0] ?? null;

    setSelectedImageFile(file);

    if (!file) {
      setImagePreviewUrl('');
      return;
    }

    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function uploadProductImage(productId: string, file: File) {
    if (!isSupabaseConfigured || supabaseClient === null) {
      throw new Error('Image upload requires Supabase');
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('Product image must be an image file');
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error('Product image is too large');
    }

    const extension = getImageExtension(file.name);
    const imagePath = `products/${productId}-${Date.now()}.${extension}`;
    const storage = supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET);
    const uploadResult = await storage.upload(imagePath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: true,
    });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    return storage.getPublicUrl(imagePath).data.publicUrl;
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    try {
      const name = form.name.trim();
      const description = form.description.trim();
      const price = parseProductPrice(form.price);
      const productId = form.id ?? crypto.randomUUID();
      const imageUrl = selectedImageFile
        ? await uploadProductImage(productId, selectedImageFile)
        : form.imageUrl.trim() || undefined;

      await saveProductUseCase.execute({
        id: productId,
        name,
        description,
        price,
        category: form.category,
        imageUrl,
        active: form.active,
      });

      resetForm();
      await loadProducts();
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel salvar o produto.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        className="h-fit rounded border border-zinc-200 bg-white p-4 shadow-sm"
        onSubmit={submitProduct}
      >
        <div className="mb-4 flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-rose-700" />
          <h2 className="text-lg font-semibold text-zinc-950">
            {form.id ? 'Editar produto' : 'Novo produto'}
          </h2>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Nome
            <input
              className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
              required
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Descricao
            <textarea
              className="min-h-24 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
              required
              value={form.description}
              onChange={(event) =>
                updateForm('description', event.target.value)
              }
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Preco
            <input
              className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
              min="0"
              required
              step="0.01"
              type="number"
              value={form.price}
              onChange={(event) => updateForm('price', event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Categoria
            <select
              className="h-10 rounded border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
              required
              value={form.category}
              onChange={(event) =>
                updateForm('category', event.target.value as ProductCategory)
              }
            >
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Foto do produto
            <input
              accept="image/*"
              className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-950 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-800"
              key={imageInputKey}
              type="file"
              onChange={updateImageFile}
            />
          </label>

          {imagePreviewUrl || form.imageUrl ? (
            <div className="overflow-hidden rounded border border-zinc-200 bg-zinc-50">
              <img
                alt="Previa da foto do produto"
                className="aspect-[4/3] w-full object-cover"
                src={imagePreviewUrl || form.imageUrl}
              />
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              checked={form.active}
              className="h-4 w-4 accent-rose-700"
              type="checkbox"
              onChange={(event) => updateForm('active', event.target.checked)}
            />
            Produto ativo
          </label>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="flex h-11 items-center justify-center gap-2 rounded bg-rose-700 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            className="h-11 rounded border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
            type="button"
            onClick={resetForm}
          >
            Limpar
          </button>
        </div>
      </form>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">Cardapio</h2>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
            type="button"
            onClick={loadProducts}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Carregando produtos...
          </div>
        ) : null}

        {!isLoading && products.length === 0 ? (
          <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Nenhum produto cadastrado.
          </div>
        ) : null}

        <div className="grid gap-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="grid gap-4 rounded border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[120px_1fr_auto]"
            >
              <div className="aspect-[4/3] overflow-hidden rounded bg-zinc-100">
                {product.imageUrl ? (
                  <img
                    alt={product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={product.imageUrl}
                  />
                ) : (
                  <div className="grid h-full place-items-center px-3 text-center text-xs font-medium text-zinc-500">
                    Sem foto
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-950">
                    {product.name}
                  </h3>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      product.active
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                    {product.category}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {product.description}
                </p>
                <p className="mt-3 text-base font-semibold text-zinc-950">
                  {formatCurrency(product.price)}
                </p>
              </div>

              <button
                className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
                type="button"
                onClick={() => editProduct(product)}
              >
                <Edit3 className="h-4 w-4" />
                Editar
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
