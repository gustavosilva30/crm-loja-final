-- Migration: Stock Reservation for Shopping Cart
-- This trigger automatically handles reserving (decrementing) stock when an item is added to the cart,
-- and returning it when removed or quantity is decreased.

-- Function to handle cart item changes
CREATE OR REPLACE FUNCTION trg_carrinho_manage_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Reserve stock for the new cart item
        UPDATE public.produtos
        SET estoque_atual = estoque_atual - NEW.quantidade
        WHERE id = NEW.produto_id;
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Adjust stock based on the quantity difference
        IF NEW.quantidade <> OLD.quantidade THEN
            UPDATE public.produtos
            SET estoque_atual = estoque_atual - (NEW.quantidade - OLD.quantidade)
            WHERE id = NEW.produto_id;
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Return reserved stock
        UPDATE public.produtos
        SET estoque_atual = estoque_atual + OLD.quantidade
        WHERE id = OLD.produto_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists to avoid duplication
DROP TRIGGER IF EXISTS trg_carrinho_manage_stock_trigger ON public.carrinho_itens;

-- Create the trigger on carrinho_itens table
CREATE TRIGGER trg_carrinho_manage_stock_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.carrinho_itens
FOR EACH ROW EXECUTE FUNCTION trg_carrinho_manage_stock();
