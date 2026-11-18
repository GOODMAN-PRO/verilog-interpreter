module top;
  function automatic f(input set);
    reg x;
    begin if (set) x=1; f=x; end
  endfunction
  initial begin $display("%b",f(1)); $display("%b",f(0)); end
endmodule
