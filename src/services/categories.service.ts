import {callFrappeMethod, toAbsoluteFileUrl} from './frappe.client';

export type Category = {
  id: string;
  image: string | null;
  isGroup: boolean;
  name: string;
  parentId: string;
  // Backend `custom_published` flag — hide unpublished groups from the storefront.
  published: boolean;
};

export const TOP_LEVEL_PARENT = 'All Item Groups';

type ItemGroup = {
  image: string | null;
  is_group: 0 | 1;
  item_group_name: string;
  name: string;
  parent_item_group: string;
  custom_published?: 0 | 1 | null;
};

export async function fetchCategories(): Promise<Category[]> {
  const groups = await callFrappeMethod<ItemGroup[]>(
    'buy_in_minutes.api.get_item_groups',
    undefined,
    'categories',
  );

  return groups.map(group => ({
    id: group.name,
    image: toAbsoluteFileUrl(group.image),
    isGroup: group.is_group === 1,
    name: group.item_group_name,
    parentId: group.parent_item_group,
    published: group.custom_published === 1,
  }));
}
