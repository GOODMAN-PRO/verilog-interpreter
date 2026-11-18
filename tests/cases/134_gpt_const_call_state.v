module top;
  function f(input set);
    reg v;
    begin if (set) v=1; f=v; end
  endfunction
  parameter A=f(1);
  initial $display("%b",f(0));
endmodule
