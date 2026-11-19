module A(output wor p); assign p=1; endmodule
module B(output supply0 p);  endmodule
module top; wire w; A a(w); B b(w); initial #1 $display("%b", w); endmodule
