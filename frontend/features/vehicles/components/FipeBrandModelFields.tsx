'use client';

import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { FipeCategory } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFipeBrands, useFipeModels } from '@/features/fipe/hooks/use-fipe';
import type { VehicleFormValues } from './VehicleFormModal';

const OTHER_OPTION_VALUE = '__OTHER__';

const CATEGORY_OPTIONS: Array<{ value: FipeCategory; label: string }> = [
  { value: 'CAR', label: 'Carro' },
  { value: 'MOTORCYCLE', label: 'Moto' },
  { value: 'TRUCK', label: 'Caminhão' },
];

interface FipeBrandModelFieldsProps {
  form: UseFormReturn<VehicleFormValues>;
  // Edição: marca/modelo já cadastrados aparecem como texto livre
  // pré-preenchido (igual hoje) — não há como "adivinhar" a categoria
  // original, então a recepção só entra nos selects da FIPE se quiser
  // *trocar* marca/modelo. Criação: começa direto nos selects.
  isEditing: boolean;
  initialBrand?: string;
  initialModel?: string;
}

export function FipeBrandModelFields({ form, isEditing, initialBrand, initialModel }: FipeBrandModelFieldsProps) {
  const [category, setCategory] = useState<FipeCategory>('CAR');
  const [brandMode, setBrandMode] = useState<'select' | 'manual'>(isEditing || initialBrand ? 'manual' : 'select');
  const [modelMode, setModelMode] = useState<'select' | 'manual'>(isEditing || initialBrand || initialModel ? 'manual' : 'select');
  const [selectedBrandId, setSelectedBrandId] = useState<string | undefined>(undefined);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);

  const { data: brandsData, isLoading: isLoadingBrands } = useFipeBrands(category);
  const { data: modelsData, isLoading: isLoadingModels } = useFipeModels(selectedBrandId, { enabled: brandMode === 'select' });

  function resetBrandAndModel() {
    setSelectedBrandId(undefined);
    setSelectedModelId(undefined);
    setBrandMode('select');
    setModelMode('select');
    form.setValue('brand', '');
    form.setValue('model', '');
  }

  function handleCategoryChange(value: string) {
    setCategory(value as FipeCategory);
    // Edge Case 4 da spec: trocar categoria invalida a marca/modelo já
    // escolhidos (a lista antiga não faz sentido pra categoria nova).
    resetBrandAndModel();
  }

  function handleBrandChange(value: string) {
    const keepInitialModel = !isEditing && !selectedBrandId && Boolean(initialModel) && form.getValues('model') === initialModel;
    if (value === OTHER_OPTION_VALUE) {
      setBrandMode('manual');
      setSelectedBrandId(undefined);
      form.setValue('brand', '');
    } else {
      const brand = brandsData?.brands.find((item) => item.id === value);
      setSelectedBrandId(value);
      form.setValue('brand', brand?.name ?? '');
    }
    // Trocar de marca invalida o modelo escolhido antes.
    if (!keepInitialModel) {
      setModelMode(value === OTHER_OPTION_VALUE ? 'manual' : 'select');
      setSelectedModelId(undefined);
      form.setValue('model', '');
    }
  }

  function handleModelChange(value: string) {
    if (value === OTHER_OPTION_VALUE) {
      setModelMode('manual');
      setSelectedModelId(undefined);
      form.setValue('model', '');
    } else {
      const model = modelsData?.models.find((item) => item.id === value);
      setSelectedModelId(value);
      form.setValue('model', model?.name ?? '');
    }
  }

  function switchBrandToFipeList() {
    setBrandMode('select');
    setSelectedBrandId(undefined);
    form.setValue('brand', '');
    setModelMode('select');
    setSelectedModelId(undefined);
    form.setValue('model', '');
  }

  function switchModelToFipeList() {
    setModelMode('select');
    setSelectedModelId(undefined);
    form.setValue('model', '');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text" htmlFor="fipe-category">
          Categoria
        </label>
        <Select value={category} onValueChange={handleCategoryChange}>
          <SelectTrigger id="fipe-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="brand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marca</FormLabel>
              {brandMode === 'select' ? (
                <Select onValueChange={handleBrandChange} value={selectedBrandId ?? ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingBrands ? 'Carregando marcas...' : 'Escolha a marca'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {brandsData?.brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_OPTION_VALUE}>Outro (digitar manualmente)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <FormControl>
                    <Input placeholder="Fiat" {...field} />
                  </FormControl>
                  <Button type="button" variant="link" size="sm" className="h-auto justify-start px-0" onClick={switchBrandToFipeList}>
                    Selecionar da lista FIPE
                  </Button>
                </>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modelo</FormLabel>
              {modelMode === 'select' ? (
                <Select onValueChange={handleModelChange} disabled={!selectedBrandId} value={selectedModelId ?? ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !selectedBrandId ? 'Escolha uma marca primeiro' : isLoadingModels ? 'Carregando modelos...' : 'Escolha o modelo'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {modelsData?.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_OPTION_VALUE}>Outro (digitar manualmente)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <FormControl>
                    <Input placeholder="Uno" {...field} />
                  </FormControl>
                  {selectedBrandId && (
                    <Button type="button" variant="link" size="sm" className="h-auto justify-start px-0" onClick={switchModelToFipeList}>
                      Selecionar da lista FIPE
                    </Button>
                  )}
                </>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
